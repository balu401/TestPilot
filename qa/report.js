/**
 * Report generator — builds an HTML evidence report from the actual
 * execution results.
 *
 * The report includes per-scenario pass/fail status, bug findings with
 * reproduction steps, screenshots, and generated-test references.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[ch]);
}

function statusBadge(status) {
  const colors = { pass: "#188154", fail: "#b43c35", error: "#c27600" };
  const color = colors[status] || "#6b7685";
  return `<span style="display:inline-block;padding:3px 8px;border-radius:10px;background:${color}15;color:${color};font-size:10px;font-weight:700;text-transform:uppercase">${escapeHtml(status)}</span>`;
}

async function writeReport(artifactRoot) {
  const result = JSON.parse(await fs.readFile(path.join(artifactRoot, "result.json"), "utf8"));

  // ---- Scenario rows ----
  const scenarioRows = result.scenarioResults.map((sr, i) => {
    const stepRows = sr.stepResults.map((step) => `
      <tr>
        <td style="padding:6px 10px;font-size:11px;color:#566277">${escapeHtml(step.action)}</td>
        <td style="padding:6px 10px;font-size:11px">${escapeHtml(step.description)}</td>
        <td style="padding:6px 10px">${statusBadge(step.status)}</td>
        <td style="padding:6px 10px;font-size:10px;color:#6b7a8d">${escapeHtml(step.actual || "")}</td>
        <td style="padding:6px 10px;font-size:10px">${step.screenshot ? `<a href="${escapeHtml(step.screenshot)}">📷</a>` : ""}</td>
      </tr>`).join("");

    return `
    <article style="border:1px solid #dfe5ec;border-radius:6px;margin:14px 0;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#f7f9fb;border-bottom:1px solid #edf0f4">
        <h3 style="margin:0;font-size:14px">${i + 1}. ${escapeHtml(sr.scenario.title)}</h3>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:10px;color:#8893a3">${sr.scenario.type} · ${sr.scenario.priority}</span>
          ${statusBadge(sr.status)}
        </div>
      </div>
      <div style="padding:0 18px">
        <p style="font-size:11px;color:#627289">${escapeHtml(sr.scenario.expectedOutcome)}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
          <thead><tr style="border-bottom:1px solid #edf0f4">
            <th style="padding:6px 10px;text-align:left;font-size:10px;color:#8a96a5">Action</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;color:#8a96a5">Description</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;color:#8a96a5">Status</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;color:#8a96a5">Actual</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;color:#8a96a5">Evidence</th>
          </tr></thead>
          <tbody>${stepRows}</tbody>
        </table>
      </div>
    </article>`;
  }).join("");

  // ---- Bug rows ----
  const bugRows = result.bugs.map((bug, i) => `
    <article style="border:1px solid #f0c4a4;border-radius:6px;margin:14px 0;background:#fffaf6;overflow:hidden">
      <div style="padding:16px 18px;border-bottom:1px solid #f0c4a4">
        <h3 style="margin:0 0 6px;font-size:14px;color:#8b3e16">🐛 ${i + 1}. ${escapeHtml(bug.title)}</h3>
        <p style="margin:0;font-size:11px">
          <strong style="color:#b44d20">${escapeHtml(bug.severity.toUpperCase())}</strong> ·
          ${escapeHtml(bug.classification.replace(/_/g, " "))} ·
          confidence ${(bug.confidence * 100).toFixed(0)}%
        </p>
      </div>
      <div style="padding:14px 18px">
        <h4 style="margin:0 0 6px;font-size:12px">Steps to reproduce</h4>
        <ol style="margin:0 0 12px;padding-left:20px;font-size:11px;color:#4e5c71">${bug.reproduction.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
        <p style="font-size:11px"><strong>Expected:</strong> ${escapeHtml(bug.expected)}</p>
        <p style="font-size:11px"><strong>Actual:</strong> ${escapeHtml(bug.actual)}</p>
        <p style="font-size:11px"><strong>Assertion:</strong> <code style="background:#f2f2f2;padding:2px 5px;border-radius:3px">${escapeHtml(bug.assertion)}</code></p>
        ${bug.evidence.map((e) => `<img src="${escapeHtml(e)}" alt="Evidence" style="max-width:100%;border:1px solid #ddd;border-radius:4px;margin-top:8px">`).join("")}
      </div>
    </article>`).join("");

  // ---- Full report ----
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QA Report — ${escapeHtml(result.runId)}</title>
  <style>
    body { font: 14px/1.6 system-ui, -apple-system, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 20px; color: #1d2b3f; background: #f5f7fa; }
    h1 { font-size: 24px; margin: 0 0 6px; } h2 { font-size: 18px; margin: 28px 0 10px; border-bottom: 1px solid #e5e9ef; padding-bottom: 6px; }
    .meta { color: #6b7a8d; font-size: 12px; margin: 0 0 24px; }
    .summary { display: flex; gap: 24px; padding: 16px 20px; background: #fff; border: 1px solid #dfe5ec; border-radius: 6px; margin-bottom: 24px; }
    .metric strong { display: block; font-size: 22px; color: #1d62bd; } .metric span { font-size: 10px; color: #8893a3; }
    .metric.bugs strong { color: #b43c35; }
    code { background: #f0f2f5; padding: 2px 5px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Autonomous QA Report</h1>
  <p class="meta">
    <code>${escapeHtml(result.runId)}</code> ·
    ${escapeHtml(result.appUrl)} ·
    ${escapeHtml(result.startedAt)} → ${escapeHtml(result.completedAt)}
  </p>
  <p style="font-size:12px;color:#4e5c71"><strong>Acceptance criteria:</strong> ${escapeHtml(result.description)}</p>

  <div class="summary">
    <div class="metric"><strong>${result.summary.totalScenarios}</strong><span>scenarios</span></div>
    <div class="metric"><strong>${result.summary.passed}</strong><span>passed</span></div>
    <div class="metric"><strong>${result.summary.failed}</strong><span>failed</span></div>
    <div class="metric bugs"><strong>${result.summary.confirmedBugs}</strong><span>confirmed bugs</span></div>
    <div class="metric"><strong>${result.summary.status.replace(/_/g, " ")}</strong><span>overall</span></div>
  </div>

  ${result.bugs.length ? `<h2>Findings</h2>${bugRows}` : ""}
  <h2>Scenario Details</h2>${scenarioRows}
  <h2>Artifacts</h2>
  <p style="font-size:12px;color:#627289">
    Machine-readable result: <code>result.json</code>.
    Generated Playwright test: <code>generated/</code>.
    Screenshots: <code>screenshots/</code>.
  </p>
</body>
</html>`;

  await fs.writeFile(path.join(artifactRoot, "report.html"), html);
}

if (require.main === module) {
  writeReport(path.resolve(process.env.ARTIFACT_DIR || "artifacts/latest")).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { writeReport };
