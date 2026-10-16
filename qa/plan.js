/**
 * Plan builder — validates analyzed scenarios into a structured, Zod-validated
 * test plan ready for execution.
 */

const { qaPlan } = require("./schemas");

/**
 * Create a validated QA plan from analyzed scenarios.
 *
 * @param {string} appUrl - Target application URL
 * @param {string} description - User-provided acceptance criteria
 * @param {Array} scenarios - Scenarios produced by the analyze step
 * @returns {object} Validated plan object
 */
function createPlan(appUrl, description, scenarios) {
  return qaPlan.parse({
    appUrl,
    description,
    scenarios,
    generatedAt: new Date().toISOString(),
  });
}

module.exports = { createPlan };
