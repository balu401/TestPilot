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
      : "The app should let a customer add a product, see an accurate total, and complete checkout.";
    const id = crypto.randomUUID();
    const artifactDir = path.join(artifactRoot, id);
    const record = { id, appUrl, description, status: "queued", createdAt: new Date().toISOString() };
    runs.set(id, record);
    res.status(202).json(record);

    void (async () => {
      runs.set(id, { ...record, status: "running", startedAt: new Date().toISOString() });
      try {
        const result = await run({ appUrl, description, artifactDir });
        await writeReport(artifactDir);
        runs.set(id, { ...record, status: "completed", completedAt: new Date().toISOString(), summary: result.summary });
      } catch (error) {
        runs.set(id, { ...record, status: "failed", completedAt: new Date().toISOString(), error: error.message });
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
