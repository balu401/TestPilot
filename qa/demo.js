const { spawn } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");
const { run } = require("./run");
const { writeReport } = require("./report");

async function main() {
  const server = spawn(process.execPath, ["sample-app/server.js"], {
    stdio: ["ignore", "pipe", "inherit"],
  });

  try {
    // Wait for the sample app to emit its first output (listening message)
    await once(server.stdout, "data");
    const artifactRoot = path.resolve("artifacts/latest");
    const result = await run({ artifactDir: artifactRoot });
    await writeReport(artifactRoot);

    if (result.summary.confirmedBugs < 1) {
      throw new Error("Demo did not confirm the planted bug — agent may not be discovering the app correctly.");
    }

    console.log(`\nEvidence report written to ${artifactRoot}/report.html`);
    console.log(`Scenarios: ${result.summary.totalScenarios} | Passed: ${result.summary.passed} | Failed: ${result.summary.failed} | Bugs: ${result.summary.confirmedBugs}`);
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
