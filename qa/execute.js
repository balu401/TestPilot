/**
 * Generic test executor — drives Playwright actions based on step
 * instructions from the plan, using discovered selectors.
 *
 * Annotates observed evidence selectors onto steps so downstream codegen
 * can emit concrete assertions.
 */

const {
  resolveLocator,
  assertFormRejected,
  assertFormAccepted,
  assertVisible,
  assertHidden,
  assertTextContains,
} = require("./assert");

function now() {
  return new Date().toISOString();
}

/**
 * Execute a single step instruction against the live page.
 * Returns a stepResult object.
 */
async function executeStep(page, step, evidenceCollector) {
  const start = Date.now();
  let status = "pass";
  let actual = "";
  let error = null;
  let screenshot = null;
  let evidenceSelector = null;

  try {
    switch (step.action) {
      // ---- Navigation ----
      case "navigate":
        await page.goto(step.value, { waitUntil: "domcontentloaded", timeout: 15_000 });
        actual = `Navigated to ${step.value}`;
        break;

      // ---- Form interactions ----
      case "fill": {
        const locator = resolveLocator(page, step.selector);
        await locator.waitFor({ state: "visible", timeout: 5000 });
        await locator.fill(step.value || "");
        actual = `Filled with "${step.value}"`;
        break;
      }
      case "click": {
        const locator = resolveLocator(page, step.selector);
        await locator.waitFor({ state: "visible", timeout: 5000 });
        page._preClickUrl = page.url();
        await locator.click();
        await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
        actual = `Clicked ${step.selector.strategy}="${step.selector.value}"`;
        break;
      }
      case "check": {
        const locator = resolveLocator(page, step.selector);
        await locator.waitFor({ state: "visible", timeout: 5000 });
        await locator.check();
        actual = "Checked";
        break;
      }
      case "uncheck": {
        const locator = resolveLocator(page, step.selector);
        await locator.waitFor({ state: "visible", timeout: 5000 });
        await locator.uncheck();
        actual = "Unchecked";
        break;
      }
      case "select": {
        const locator = resolveLocator(page, step.selector);
        await locator.waitFor({ state: "visible", timeout: 5000 });
        await locator.selectOption(step.value || "");
        actual = `Selected "${step.value}"`;
        break;
      }

      // ---- Waits ----
      case "wait_for_visible": {
        const locator = resolveLocator(page, step.selector);
        await locator.waitFor({ state: "visible", timeout: 10_000 });
        actual = "Element became visible";
        break;
      }
      case "wait_for_hidden": {
        const locator = resolveLocator(page, step.selector);
        await locator.waitFor({ state: "hidden", timeout: 10_000 });
        actual = "Element became hidden";
        break;
      }
      case "wait_for_navigation":
        await page.waitForURL(step.value || "**", { timeout: 10_000 });
        actual = `Navigated to ${page.url()}`;
        break;

      // ---- Assertions ----
      case "assert_visible": {
        const result = await assertVisible(page, step.selector);
        status = result.pass ? "pass" : "fail";
        actual = result.actual;
        evidenceSelector = step.selector;
        break;
      }
      case "assert_hidden": {
        const result = await assertHidden(page, step.selector);
        status = result.pass ? "pass" : "fail";
        actual = result.actual;
        break;
      }
      case "assert_text_contains": {
        const result = await assertTextContains(page, step.selector, step.value);
        status = result.pass ? "pass" : "fail";
        actual = result.actual;
        break;
      }
      case "assert_url_contains": {
        const currentUrl = page.url();
        if (currentUrl.includes(step.value)) {
          actual = `URL "${currentUrl}" contains "${step.value}"`;
        } else {
          status = "fail";
          actual = `URL "${currentUrl}" does not contain "${step.value}"`;
        }
        break;
      }
      case "assert_url_not_contains": {
        const currentUrl = page.url();
        if (!currentUrl.includes(step.value)) {
          actual = `URL "${currentUrl}" does not contain "${step.value}" (as expected)`;
        } else {
          status = "fail";
          actual = `URL "${currentUrl}" unexpectedly contains "${step.value}"`;
        }
        break;
      }

      // ---- Smart form assertions ----
      case "assert_form_rejected": {
        const preUrl = page._preClickUrl || page.url();
        const result = await assertFormRejected(page, preUrl);
        status = result.pass ? "pass" : "fail";
        actual = result.actual;
        break;
      }
      case "assert_form_accepted": {
        const preUrl = page._preClickUrl || page.url();
        const result = await assertFormAccepted(page, preUrl);
        status = result.pass ? "pass" : "fail";
        actual = result.actual;
        if (result.successSelector) {
          evidenceSelector = result.successSelector;
          step.evidenceSelector = result.successSelector;
        }
        break;
      }

      default:
        status = "skip";
        actual = `Unknown action: ${step.action}`;
        break;
    }
  } catch (err) {
    status = "error";
    error = err.message;
    actual = `Error: ${err.message}`;
  }

  // Capture screenshot after every step (for evidence trail)
  if (evidenceCollector) {
    try {
      screenshot = await evidenceCollector.screenshot(page, step.description);
    } catch { /* screenshot failure should not block the run */ }
  }

  return {
    action: step.action,
    description: step.description,
    status,
    actual,
    error,
    screenshot,
    evidenceSelector,
    durationMs: Date.now() - start,
    timestamp: now(),
  };
}

/**
 * Execute an entire test scenario (a sequence of steps).
 */
async function executeScenario(page, scenario, evidenceCollector, options = {}) {
  const start = Date.now();
  const stepResults = [];
  const bugs = [];
  let overallStatus = "pass";
  const emit = options.onEvent || (() => {});

  for (const step of scenario.steps) {
    await emit({
      type: "step",
      action: step.action,
      target: step.selector ? `${step.selector.strategy}="${step.selector.value}"` : step.value || "",
      description: step.description,
    });

    const result = await executeStep(page, step, evidenceCollector);
    stepResults.push(result);

    if (result.status === "fail") {
      overallStatus = "fail";

      if (step.action.startsWith("assert_")) {
        const bug = {
          id: `bug-${scenario.id}-${stepResults.length}`,
          scenarioId: scenario.id,
          title: `${scenario.title}: ${step.description}`,
          classification: "confirmed_bug",
          severity: scenario.priority === "P0" ? "high" : scenario.priority === "P1" ? "medium" : "low",
          confidence: 0.95,
          reproduction: scenario.steps
            .slice(0, stepResults.length)
            .map((s) => s.description),
          expected: scenario.expectedOutcome,
          actual: result.actual,
          assertion: `${step.action}(${step.selector ? step.selector.value : "page"})`,
          evidence: result.screenshot ? [result.screenshot] : [],
          detectedAt: now(),
        };
        bugs.push(bug);

        await emit({
          type: "finding",
          severity: bug.severity,
          label: bug.title,
          detail: bug.actual,
        });
      }

      if (step.action.startsWith("assert_")) break;
    }

    if (result.status === "error") {
      overallStatus = "error";
      break;
    }

    if (options.demoPacing) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return {
    scenario,
    stepResults,
    status: overallStatus,
    bugs,
    durationMs: Date.now() - start,
  };
}

module.exports = { executeStep, executeScenario };
