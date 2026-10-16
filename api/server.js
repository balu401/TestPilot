const express = require("express");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { run } = require("../qa/run");
const { writeReport } = require("../qa/report");

const app = express();
const port = Number(process.env.PORT || 4300);
const dashboardRoot = path.resolve("dashboard");
const artifactRoot = path.resolve("artifacts/runs");
const runs = new Map();

app.use(express.json({ limit: "32kb" }));
app.use(express.static(dashboardRoot));

const legalPage = (title, sections) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - TestPilot</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>body{margin:0;background:#eef1f5;color:#1d2b3f;font:14px/1.65 system-ui,sans-serif}.page{max-width:760px;margin:48px auto;padding:34px 40px;background:#fff;border:1px solid #d8e0e9;border-radius:5px}h1{margin:0 0 8px;font-size:28px}h2{margin:28px 0 6px;font-size:17px}p{color:#627188}a{color:#1d62bd}small{color:#8995a5}</style>
</head><body><main class="page"><a href="/">Back to dashboard</a><h1>${title}</h1><small>Last updated October 16, 2026</small>${sections}</main></body></html>`;

app.get("/privacy", (req, res) => res.send(legalPage("Privacy Policy", `
  <p>TestPilot is a local prototype for browser-based quality assurance. This policy describes the data handled by this demonstration service.</p>
  <h2>Information processed</h2><p>The dashboard processes the application URL, acceptance criteria, run status, browser event records, screenshots, and generated reports needed to execute a test run.</p>
  <h2>Local demonstration scope</h2><p>Runs are stored on the machine hosting this prototype. The service does not provide user accounts, advertising, analytics, or data brokerage.</p>
  <h2>Retention</h2><p>Artifacts remain in the local artifacts directory until they are removed by the operator or replaced by a later run.</p>
  <h2>Contact</h2><p>For this prototype, contact the project owner through the repository used to deploy it.</p>`)));

app.get("/terms", (req, res) => res.send(legalPage("Terms and Conditions", `
  <p>TestPilot is provided as a demonstration of autonomous browser testing. By using it, you agree to use it only on applications you own or are authorized to test.</p>
  <h2>Authorized testing</h2><p>You are responsible for the URLs, credentials, test data, and acceptance criteria submitted to the service. Do not test systems without permission.</p>
  <h2>Prototype limitations</h2><p>This demonstration may contain simulated progress and intentionally seeded defects. It is not a production security scanner or a substitute for a complete QA program.</p>
  <h2>Availability</h2><p>The prototype is provided without a service-level guarantee. Run results should be reviewed by an engineer before release decisions are made.</p>`)));

function validateTarget(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL must be valid.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP(S) URLs are supported.");
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error("Prototype mode only allows localhost or 127.0.0.1 targets.");
  }
  return parsed.toString().replace(/\/$/, "");
}

app.post("/api/runs", async (req, res) => {
  try {
    const appUrl = validateTarget(req.body?.appUrl || "http://127.0.0.1:4173");
    const description = typeof req.body?.description === "string" && req.body.description.trim()
      ? req.body.description.trim()
      : "The registration flow should only create an account when the password and confirmation password match.";
    const id = crypto.randomUUID();
    const artifactDir = path.join(artifactRoot, id);
    const record = {
      id,
      appUrl,
      description,
      status: "queued",
      progress: 0,
      phase: "queued",
      events: [],
      createdAt: new Date().toISOString(),
    };
    runs.set(id, record);
    res.status(202).json(record);

    void (async () => {
      runs.set(id, { ...record, status: "running", startedAt: new Date().toISOString() });
      try {
        const result = await run({
          appUrl,
          description,
          artifactDir,
          demoPacing: true,
          onEvent: async (event) => {
            const current = runs.get(id);
            if (!current) return;
            const events = [...(current.events || []), event].slice(-30);
            runs.set(id, {
              ...current,
              phase: event.phase || current.phase,
              progress: event.progress ?? current.progress,
              events,
            });
          },
        });
        await writeReport(artifactDir);
        runs.set(id, {
          ...runs.get(id),
          status: "completed",
          progress: 100,
          phase: "complete",
          completedAt: new Date().toISOString(),
          summary: result.summary,
        });
      } catch (error) {
        runs.set(id, {
          ...runs.get(id),
          status: "failed",
          completedAt: new Date().toISOString(),
          error: error.message,
        });
      }
    })();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/runs", (req, res) => {
  res.json([...runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.get("/api/runs/:id", async (req, res) => {
  const record = runs.get(req.params.id);
  if (!record) return res.status(404).json({ error: "Run not found." });
  let result = null;
  if (record.status === "completed") {
    try {
      result = JSON.parse(await fs.readFile(path.join(artifactRoot, record.id, "result.json"), "utf8"));
    } catch {
      result = null;
    }
  }
  res.json({ ...record, result });
});

app.get("/api/runs/:id/report", (req, res) => {
  const record = runs.get(req.params.id);
  if (!record) return res.status(404).send("Run not found.");
  res.redirect(`/artifacts/${record.id}/report.html`);
});

app.use("/artifacts", express.static(artifactRoot));

app.get("/{*splat}", (req, res) => res.sendFile(path.join(dashboardRoot, "index.html")));

if (require.main === module) {
  app.listen(port, () => console.log(`QA dashboard listening at http://127.0.0.1:${port}`));
}

module.exports = { app, runs };
