const fs = require("node:fs/promises");
const path = require("node:path");

async function writeReport(artifactRoot) {
  const result = JSON.parse(await fs.readFile(path.join(artifactRoot, "result.json"), "utf8"));
  const bugRows = result.bugs.map((bug, index) => `<article class="bug">
    <h2>${index + 1}. ${bug.title}</h2>
    <p><strong>${bug.severity.toUpperCase()}</strong> · ${bug.classification} · confidence ${(bug.confidence * 100).toFixed(0)}%</p>
    <h3>Steps to reproduce</h3><ol>${bug.reproduction.map((step) => `<li>${step}</li>`).join("")}</ol>
    <p><strong>Expected:</strong> ${bug.expected}</p><p><strong>Actual:</strong> ${bug.actual}</p>
    <p><strong>Deterministic assertion:</strong> <code>${bug.assertion}</code></p>
    <img src="${bug.evidence[0]}" alt="Evidence screenshot for ${bug.title}">
  </article>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>QA report ${result.runId}</title>
    <style>body{font:16px system-ui;max-width:900px;margin:2rem auto;color:#172033}.summary{display:flex;gap:2rem;background:#eef4ff;padding:1rem}.bug{border:1px solid #ddd;border-radius:8px;padding:1rem;margin:1rem 0}.bug strong{color:#a30000}img{max-width:100%;border:1px solid #aaa}code{background:#f2f2f2;padding:.2rem}</style>
    </head><body><h1>Autonomous QA run</h1><p><code>${result.runId}</code> · ${result.appUrl}</p>
    <div class="summary"><span><strong>${result.summary.passedJourneys}</strong> journey passed</span><span><strong>${result.summary.confirmedBugs}</strong> confirmed bug(s)</span></div>
    <h2>Findings</h2>${bugRows || "<p>No confirmed bugs.</p>"}
    <h2>Artifacts</h2><p>Machine-readable result: <code>result.json</code>. Generated test: <code>generated/cart-journey.spec.js</code>.</p>
    </body></html>`;
  await fs.writeFile(path.join(artifactRoot, "report.html"), html);
}

if (require.main === module) {
  writeReport(path.resolve(process.env.ARTIFACT_DIR || "artifacts/latest")).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { writeReport };
