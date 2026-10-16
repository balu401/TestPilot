/**
 * QA runner — the main orchestrator that ties together the full pipeline:
 *
 *   discover → analyze → plan → execute → evidence → codegen → report
 *
 * This replaces the old hardcoded runner. Instead of baked-in selectors and
 * test data, it dynamically discovers the target app's structure, generates
 * scenarios based on the user's acceptance criteria, and executes them with
 * the generic step executor.
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");
const { discoverSite } = require("./discover");
const { analyzeForTesting } = require("./analyze");
const { createPlan } = require("./plan");
const { executeScenario } = require("./execute");
const { createEvidenceCollector } = require("./evidence");
const { generatePlaywrightTest, testFileName } = require("./codegen");

function now() {
  return new Date().toISOString();
}

async function ensureArtifacts(artifactRoot) {
  await fs.rm(artifactRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(artifactRoot, "screenshots"), { recursive: true });
  await fs.mkdir(path.join(artifactRoot, "generated"), { recursive: true });
}

async function run(options = {}) {
  const baseUrl = options.appUrl || process.env.APP_URL || "http://127.0.0.1:4173";
  const artifactRoot = path.resolve(
    options.artifactDir || process.env.ARTIFACT_DIR || "artifacts/latest"
  );
  await ensureArtifacts(artifactRoot);
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const description =
    options.description ||
    "The registration flow should only create an account when the password and confirmation password match.";

  const emit = async (event) => {
    if (typeof options.onEvent === "function") await options.onEvent({ at: now(), ...event });
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const evidence = createEvidenceCollector(artifactRoot);
  evidence.startConsoleCapture(page);
  const startedAt = now();

  try {
    // ── Phase 1: Discovery ──────────────────────────────────────────
    await emit({
      type: "phase", phase: "discovering", label: "Discovering application",
      detail: `Crawling ${baseUrl} to map pages, forms, and interactive elements.`,
      progress: 10,
    });

    const siteMapData = await discoverSite(page, baseUrl, { maxDepth: 2, maxPages: 10 });

    if (siteMapData.pages.length === 0) {
      throw new Error(`Discovery found no pages at ${baseUrl}. Is the application running?`);
    }

    await emit({
      type: "phase", phase: "discovered", label: "Discovery complete",
      detail: `Found ${siteMapData.pages.length} page(s) with ${siteMapData.pages.reduce((n, p) => n + p.forms.length, 0)} form(s).`,
      progress: 25,
    });

    // ── Phase 2: Analysis & Planning ────────────────────────────────
    await emit({
      type: "phase", phase: "planning", label: "Analyzing and planning",
      detail: "Generating test scenarios from discovered structure and acceptance criteria.",
      progress: 30,
    });

    const scenarios = analyzeForTesting(siteMapData, description);

    if (scenarios.length === 0) {
      throw new Error("Analysis produced no test scenarios. Check the application structure and description.");
    }

    const plan = createPlan(baseUrl, description, scenarios);
    await fs.writeFile(path.join(artifactRoot, "plan.json"), JSON.stringify(plan, null, 2));

    await emit({
      type: "phase", phase: "planned", label: "Plan ready",
      detail: `${plan.scenarios.length} scenario(s) to execute: ${plan.scenarios.map((s) => s.title).join(", ")}.`,
      progress: 35,
    });

    // ── Phase 3: Execution ──────────────────────────────────────────
    const scenarioResults = [];
    const allBugs = [];
    const totalScenarios = plan.scenarios.length;

    for (let i = 0; i < totalScenarios; i++) {
      const scenario = plan.scenarios[i];
      const progressBase = 35 + Math.round((i / totalScenarios) * 50);

      await emit({
        type: "phase", phase: "testing",
        label: `Testing: ${scenario.title}`,
        detail: `Scenario ${i + 1}/${totalScenarios} (${scenario.type}, ${scenario.priority})`,
        progress: progressBase,
      });

      const result = await executeScenario(page, scenario, evidence, {
        demoPacing: options.demoPacing,
        onEvent: async (event) => {
          await emit({ ...event, progress: progressBase + 5 });
        },
      });

      scenarioResults.push(result);
      allBugs.push(...result.bugs);

      const statusLabel = result.status === "pass" ? "✓ passed" : result.status === "fail" ? "✗ failed" : "⚠ error";
      await emit({
        type: "phase", phase: "tested",
        label: `${scenario.title}: ${statusLabel}`,
        detail: result.bugs.length > 0 ? `Found ${result.bugs.length} bug(s)` : "No issues found",
        progress: progressBase + 10,
      });
    }

    // ── Phase 4: Evidence collection ────────────────────────────────
    await emit({
      type: "phase", phase: "evidence", label: "Collecting evidence",
      detail: "Writing console logs and finalizing artifacts.",
      progress: 90,
    });

    await evidence.writeConsoleLogs();

    // ── Phase 5: Build result ───────────────────────────────────────
    const summary = {
      totalScenarios,
      passed: scenarioResults.filter((r) => r.status === "pass").length,
      failed: scenarioResults.filter((r) => r.status === "fail").length,
      errors: scenarioResults.filter((r) => r.status === "error").length,
      confirmedBugs: allBugs.length,
      status: allBugs.length > 0 ? "completed_with_findings" : "completed",
    };

    const result = {
      runId,
      startedAt,
      completedAt: now(),
      appUrl: baseUrl,
      description,
      siteMap: siteMapData,
      plan,
      scenarioResults,
      summary,
      bugs: allBugs,
    };

    await fs.writeFile(path.join(artifactRoot, "result.json"), JSON.stringify(result, null, 2));

    // ── Phase 6: Generate Playwright test ───────────────────────────
    const generatedCode = generatePlaywrightTest(plan, scenarioResults, baseUrl);
    const genFileName = testFileName(plan);
    await fs.writeFile(path.join(artifactRoot, "generated", genFileName), generatedCode);
    // Also write to the project-level generated/ for direct execution, cleaning old specs
    const generatedDir = path.resolve("generated");
    await fs.mkdir(generatedDir, { recursive: true });
    const existingSpecs = await fs.readdir(generatedDir).catch(() => []);
    for (const f of existingSpecs) {
      if (f.endsWith(".spec.js")) {
        await fs.unlink(path.join(generatedDir, f)).catch(() => {});
      }
    }
    await fs.writeFile(path.join(generatedDir, genFileName), generatedCode);

    await emit({
      type: "complete", phase: "complete", label: "Run complete",
      detail: allBugs.length
        ? `Completed with ${allBugs.length} confirmed finding(s).`
        : "All planned checks passed.",
      progress: 100,
    });

    console.log(JSON.stringify(summary));
    return result;
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { run };
