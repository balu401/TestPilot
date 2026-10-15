const { z } = require("zod");

const testStep = z.object({
  action: z.string(),
  target: z.string(),
  expected: z.string()
});

const testCase = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(["P0", "P1", "P2"]),
  steps: z.array(testStep).min(1)
});

const qaPlan = z.object({
  appUrl: z.string().url(),
  description: z.string().min(1),
  testCases: z.array(testCase).min(1)
});

module.exports = { qaPlan };
