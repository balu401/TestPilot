/**
 * Evidence collector — captures screenshots and DOM snapshots at each
 * test step, tied to the artifact directory for the current run.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

/**
 * Create an evidence collector bound to a specific artifact directory.
 *
 * Usage:
 *   const collector = createEvidenceCollector(artifactRoot);
 *   const screenshotPath = await collector.screenshot(page, "01-registration");
 *   const snapshotPath = await collector.domSnapshot(page, "01-registration");
 */
function createEvidenceCollector(artifactRoot) {
  const screenshotDir = path.join(artifactRoot, "screenshots");
  const snapshotDir = path.join(artifactRoot, "snapshots");
  let counter = 0;
  const consoleLogs = [];

  return {
    /**
     * Capture a full-page screenshot.
     * Returns the relative path (from artifactRoot) to the saved image.
     */
    async screenshot(page, label) {
      counter += 1;
      const name = `${String(counter).padStart(2, "0")}-${sanitize(label)}.png`;
      const relPath = `screenshots/${name}`;
      const absPath = path.join(screenshotDir, name);
      await fs.mkdir(screenshotDir, { recursive: true });
      await page.screenshot({ path: absPath, fullPage: true });
      return relPath;
    },

    /**
     * Capture a simplified DOM snapshot (outer HTML of <body>).
     * Returns the relative path to the saved HTML file.
     */
    async domSnapshot(page, label) {
      counter += 1;
      const name = `${String(counter).padStart(2, "0")}-${sanitize(label)}.html`;
      const relPath = `snapshots/${name}`;
      const absPath = path.join(snapshotDir, name);
      await fs.mkdir(snapshotDir, { recursive: true });
      const html = await page.evaluate(() => document.body.outerHTML).catch(() => "<body>(unavailable)</body>");
      await fs.writeFile(absPath, html);
      return relPath;
    },

    /**
     * Start capturing console messages from the page.
     */
    startConsoleCapture(page) {
      page.on("console", (msg) => {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString(),
        });
      });
    },

    /**
     * Return all captured console logs.
     */
    getConsoleLogs() {
      return [...consoleLogs];
    },

    /**
     * Write console logs to disk.
     */
    async writeConsoleLogs() {
      if (consoleLogs.length === 0) return null;
      const relPath = "console.json";
      await fs.writeFile(path.join(artifactRoot, relPath), JSON.stringify(consoleLogs, null, 2));
      return relPath;
    },

    /**
     * Return the current screenshot counter (useful for naming).
     */
    getCounter() {
      return counter;
    },
  };
}

function sanitize(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);
}

module.exports = { createEvidenceCollector };
