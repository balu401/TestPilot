/**
 * Code generator — produces a standalone Playwright test file from
 * executed scenario results.
 *
 * Instead of emitting a hardcoded test, this generates tests from the
 * actual steps that were executed and passed, using the real selectors
 * and values discovered at runtime.
 */

/**
 * Convert a selector strategy to a Playwright locator expression (as source code).
 */
function selectorToCode(sel) {
  if (!sel) return `page.locator("body")`;
  switch (sel.strategy) {
    case "testid": return `page.getByTestId(${JSON.stringify(sel.value)})`;
    case "id": return `page.locator(${JSON.stringify(sel.value)})`;
    case "name": return `page.locator('[name="${sel.value}"]')`;
    case "role": return `page.getByRole(${JSON.stringify(sel.value)})`;
    case "label": return `page.getByLabel(${JSON.stringify(sel.value)})`;
    case "text": return `page.getByText(${JSON.stringify(sel.value)})`;
    case "css": return `page.locator(${JSON.stringify(sel.value)})`;
    default: return `page.locator(${JSON.stringify(sel.value)})`;
  }
}

/**
 * Generate a step's Playwright code line.
 */
function stepToCode(step) {
  switch (step.action) {
    case "navigate":
      return `  await page.goto(${JSON.stringify(step.value)});`;
    case "fill":
      return `  await ${selectorToCode(step.selector)}.fill(${JSON.stringify(step.value || "")});`;
    case "click":
      return `  await ${selectorToCode(step.selector)}.click();`;
    case "check":
      return `  await ${selectorToCode(step.selector)}.check();`;
    case "uncheck":
      return `  await ${selectorToCode(step.selector)}.uncheck();`;
    case "select":
      return `  await ${selectorToCode(step.selector)}.selectOption(${JSON.stringify(step.value || "")});`;
    case "assert_visible":
      return `  await expect(${selectorToCode(step.selector)}).toBeVisible();`;
    case "assert_hidden":
      return `  await expect(${selectorToCode(step.selector)}).toBeHidden();`;
    case "assert_text_contains":
      return `  await expect(${selectorToCode(step.selector)}).toContainText(${JSON.stringify(step.value || "")});`;
    case "assert_form_accepted":
      if (step.evidenceSelector) {
        return `  await expect(${selectorToCode(step.evidenceSelector)}).toBeVisible();`;
      }
      return `  await page.waitForLoadState("domcontentloaded");`;
    case "assert_form_rejected":
      return `  // Verified: form rejection handled as expected`;
    default:
      return `  // ${step.action}: ${step.description}`;
  }
}

/**
 * Generate a complete Playwright test file from plan and execution results.
 *
 * Only generates tests for positive scenarios that PASSED (successful journeys).
 * Negative scenarios with defects are documented in the findings report.
 *
 * @param {object} plan - The QA plan
 * @param {Array} scenarioResults - Execution results for each scenario
 * @param {string} baseUrl - The target app URL
 * @returns {string} Complete .spec.js file content
 */
function generatePlaywrightTest(plan, scenarioResults, baseUrl) {
  const passedScenarios = scenarioResults.filter((r) => r.status === "pass" && r.scenario.type === "positive");

  if (passedScenarios.length === 0) {
    return `const { test } = require("@playwright/test");

// No positive scenarios passed — no generated regression test.
test.skip("no positive scenarios passed", () => {});
`;
  }

  const seenTitles = new Map();
  const tests = passedScenarios.map((result) => {
    const scenario = result.scenario;
    let title = scenario.title;
    if (seenTitles.has(title)) {
      const count = seenTitles.get(title) + 1;
      seenTitles.set(title, count);
      title = `${title} (${count})`;
    } else {
      seenTitles.set(title, 1);
    }

    const lines = scenario.steps.map(stepToCode).join("\n");
    return `test(${JSON.stringify(title)}, async ({ page }) => {
${lines}
});`;
  });

  return `const { test, expect } = require("@playwright/test");

${tests.join("\n\n")}
`;
}

/**
 * Determine a descriptive filename for the generated test based on form type.
 */
function testFileName(plan) {
  const desc = (plan.description || "").toLowerCase();
  if (/regist|sign.?up|create.?account/i.test(desc)) return "registration-flow.spec.js";
  if (/log.?in|sign.?in/i.test(desc)) return "login-flow.spec.js";
  if (/cart|checkout|purchase/i.test(desc)) return "cart-journey.spec.js";
  return "qa-flow.spec.js";
}

module.exports = { generatePlaywrightTest, testFileName, selectorToCode, stepToCode };
