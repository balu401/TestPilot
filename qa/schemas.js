const { z } = require("zod");

// ---------------------------------------------------------------------------
// Selector strategy — how to locate an element on the page
// ---------------------------------------------------------------------------

const selectorStrategy = z.object({
  strategy: z.enum(["testid", "id", "name", "role", "label", "text", "css"]),
  value: z.string(),
});

// ---------------------------------------------------------------------------
// Discovery schemas — what the crawler finds on each page
// ---------------------------------------------------------------------------

const discoveredElement = z.object({
  tag: z.string(),
  type: z.string().optional(),
  testId: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  text: z.string().optional(),
  visible: z.boolean().optional(),
  selector: selectorStrategy,
  fallbacks: z.array(selectorStrategy).optional(),
});

const discoveredForm = z.object({
  action: z.string().optional(),
  method: z.string().optional(),
  testId: z.string().optional(),
  selector: selectorStrategy,
  fields: z.array(discoveredElement),
  submitButtons: z.array(discoveredElement),
});

const discoveredIndicator = z.object({
  type: z.enum(["success", "error", "info"]),
  testId: z.string().optional(),
  className: z.string().optional(),
  selector: selectorStrategy,
  text: z.string().optional(),
  visible: z.boolean(),
});

const discoveredLink = z.object({
  href: z.string(),
  text: z.string(),
  selector: selectorStrategy,
});

const discoveredPage = z.object({
  url: z.string(),
  title: z.string(),
  forms: z.array(discoveredForm),
  links: z.array(discoveredLink),
  buttons: z.array(discoveredElement),
  headings: z.array(z.object({ level: z.number(), text: z.string() })),
  indicators: z.array(discoveredIndicator),
});

const siteMap = z.object({
  baseUrl: z.string(),
  pages: z.array(discoveredPage),
  discoveredAt: z.string(),
});

// ---------------------------------------------------------------------------
// Plan schemas — what the agent intends to test
// ---------------------------------------------------------------------------

const stepInstruction = z.object({
  action: z.enum([
    "navigate", "fill", "click", "check", "uncheck", "select",
    "wait_for_visible", "wait_for_hidden", "wait_for_navigation",
    "assert_visible", "assert_hidden", "assert_text_contains",
    "assert_url_contains", "assert_url_not_contains",
    "assert_form_rejected", "assert_form_accepted",
  ]),
  selector: selectorStrategy.optional(),
  value: z.string().optional(),
  description: z.string(),
});

const testScenario = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["positive", "negative", "boundary"]),
  priority: z.enum(["P0", "P1", "P2"]),
  steps: z.array(stepInstruction).min(1),
  expectedOutcome: z.string(),
  reason: z.string().optional(),
  plannedBy: z.string().optional(),
});

const qaPlan = z.object({
  appUrl: z.string().url(),
  description: z.string().min(1),
  scenarios: z.array(testScenario).min(1),
  generatedAt: z.string(),
  plannedBy: z.string().optional(),
  gemmaReason: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Execution result schemas — what actually happened
// ---------------------------------------------------------------------------

const stepResult = z.object({
  action: z.string(),
  description: z.string(),
  status: z.enum(["pass", "fail", "error", "skip"]),
  actual: z.string().optional(),
  error: z.string().optional(),
  screenshot: z.string().optional(),
  durationMs: z.number(),
  timestamp: z.string(),
});

const bugFinding = z.object({
  id: z.string(),
  scenarioId: z.string(),
  title: z.string(),
  classification: z.enum(["confirmed_bug", "potential_bug", "flaky", "environment_issue", "automation_error", "environment_failure"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
  reproduction: z.array(z.string()),
  expected: z.string(),
  actual: z.string(),
  assertion: z.string(),
  evidence: z.array(z.string()),
  detectedAt: z.string(),
  gemmaVerdict: z.string().optional(),
  gemmaWhy: z.string().optional(),
  investigationCategory: z.enum(["confirmed_bug", "automation_error", "environment_failure"]).optional(),
});

const scenarioResult = z.object({
  scenario: testScenario,
  stepResults: z.array(stepResult),
  status: z.enum(["pass", "fail", "error"]),
  bugs: z.array(bugFinding),
  durationMs: z.number(),
});

const runResult = z.object({
  runId: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  appUrl: z.string(),
  description: z.string(),
  siteMap: siteMap.optional(),
  plan: qaPlan,
  scenarioResults: z.array(scenarioResult),
  summary: z.object({
    totalScenarios: z.number(),
    passed: z.number(),
    failed: z.number(),
    errors: z.number(),
    confirmedBugs: z.number(),
    status: z.enum(["completed", "completed_with_findings", "failed"]),
  }),
  bugs: z.array(bugFinding),
});

module.exports = {
  selectorStrategy,
  discoveredElement,
  discoveredForm,
  discoveredIndicator,
  discoveredLink,
  discoveredPage,
  siteMap,
  stepInstruction,
  testScenario,
  qaPlan,
  stepResult,
  bugFinding,
  scenarioResult,
  runResult,
};
