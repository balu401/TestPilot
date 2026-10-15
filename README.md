# Autonomous QA Engineer — Stage-2 Prototype

This prototype demonstrates the Stage-2 acceptance path for IM-02:

1. Start a controlled sample web app with a deliberately planted cart-total defect.
2. Build and validate a structured QA plan.
3. Run a real browser journey with Playwright.
4. Verify the expected behavior with a deterministic assertion.
5. Capture screenshots and file a reproducible, evidence-backed bug report.
6. Generate a reusable Playwright test and run it independently.

## Run the demo

```bash
npm install
npx playwright install chromium
npm run demo
npm run start:app
npm run test:generated
```

The demo writes `artifacts/latest/result.json`, `artifacts/latest/report.html`, screenshots, and the generated test. Open `artifacts/latest/report.html` in a browser to present the finding.

## What is intentionally bounded

The first slice uses a controlled local application and deterministic Playwright execution so the stage demo is repeatable without exposing arbitrary websites or requiring an LLM key. The planner schema and runner boundaries are isolated in `qa/`; the next increment can replace `qa/plan.js` with an LLM/Stagehand-backed explorer while keeping evidence verification and reporting deterministic.

The seeded bug is not supplied to the runner. It is only encoded in the sample app, while the runner derives the failure by comparing the observed line-item price with the observed total.
