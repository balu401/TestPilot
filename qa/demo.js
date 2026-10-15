const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { run } = require("./run");
const { writeReport } = require("./report");
const { chromium } = require("playwright");

async function main() {
  const server = spawn(process.execPath, ["sample-app/server.js"], { stdio: ["ignore", "pipe", "inherit"] });
  try {
    await once(server.stdout, "data");
    const artifactRoot = require("node:path").resolve("artifacts/latest");
    const result = await run({ artifactDir: artifactRoot });
    await writeReport(artifactRoot);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto("file://" + require("node:path").resolve(artifactRoot, "report.html"));
    await browser.close();
    if (result.summary.confirmedBugs < 1) throw new Error("Demo did not confirm a planted bug");
    console.log(`Evidence report written to ${artifactRoot}/report.html`);
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
