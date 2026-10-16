# Autonomous AI QA Engineer — TestPilot

This repository contains the autonomous QA agent prototype for the iMocha Track problem statement **IM-02: Autonomous AI QA Engineer**.

TestPilot autonomously explores a web application, maps its DOM structure, analyzes the user's acceptance criteria, synthesizes positive, negative, and boundary test scenarios, executes them in a real Chromium browser, verifies behaviors with high-precision assertions, captures evidence, and generates regression Playwright tests.

---

## Autonomous Pipeline Architecture

```text
User Criteria + App URL
        │
        ▼
1. Discovery Engine (qa/discover.js)
   Crawls application, builds site map of pages, forms, fields, links, and indicators
        │
        ▼
2. Analysis Engine (qa/analyze.js)
   Parses criteria keywords, deduplicates forms, synthesizes test scenarios (P0/P1/P2)
        │
        ▼
3. Plan Builder (qa/plan.js & qa/schemas.js)
   Validates scenarios against strict Zod schemas
        │
        ▼
4. Generic Executor (qa/execute.js)
   Dispatches Playwright actions using discovered selector strategies (testid, id, name, css)
        │
        ▼
5. Assertion Engine (qa/assert.js)
   High-precision evaluation: checks indicators, HTML5 validation, and response states
        │
        ▼
6. Evidence Collector (qa/evidence.js)
   Captures full-page screenshots, DOM snapshots, and console logs at every step
        │
        ├──▶ 7. Test Generator (qa/codegen.js) -> Standalone Playwright regression suite
        └──▶ 8. Evidence Report (qa/report.js) -> Interactive HTML report with findings
```

---

## Key Modules

- **[`qa/discover.js`](file:///home/void/git/TestPilot/qa/discover.js)**: Live crawler that inspects the live DOM to catalog interactive elements, forms, links, and status indicators.
- **[`qa/analyze.js`](file:///home/void/git/TestPilot/qa/analyze.js)**: Intelligent scenario generator that creates happy paths, validation boundary cases, and defect-seeking negative scenarios with form deduplication.
- **[`qa/assert.js`](file:///home/void/git/TestPilot/qa/assert.js)**: High-precision assertion engine with container exclusions and HTML5 client-validation checks to eliminate false positives.
- **[`qa/execute.js`](file:///home/void/git/TestPilot/qa/execute.js)**: Generic step executor that drives Playwright actions and captures evidence selectors.
- **[`qa/codegen.js`](file:///home/void/git/TestPilot/qa/codegen.js)**: Dynamic code generator that writes clean, independently runnable Playwright test suites.
- **[`qa/evidence.js`](file:///home/void/git/TestPilot/qa/evidence.js)**: Evidence collector capturing screenshots, console output, and DOM snapshots.
- **[`qa/report.js`](file:///home/void/git/TestPilot/qa/report.js)**: Generates detailed HTML reports with step-by-step tables and bug reproduction trails.
- **[`qa/schemas.js`](file:///home/void/git/TestPilot/qa/schemas.js)**: Comprehensive Zod validation schemas for all data models.
- **[`api/server.js`](file:///home/void/git/TestPilot/api/server.js)**: Mission control API and static dashboard server.
- **[`dashboard/index.html`](file:///home/void/git/TestPilot/dashboard/index.html)**: Interactive web dashboard showing real-time pipeline stages and findings.

---

## Prerequisites

- **Node.js**: v18 or newer
- **npm**: v9 or newer
- **Operating System**: Linux, macOS, or Windows

Check your installed versions:
```bash
node --version
npm --version
```

---

## Installation

1. Clone or navigate to the repository directory:
   ```bash
   cd /path/to/TestPilot
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Install the Playwright Chromium browser:
   ```bash
   npx playwright install chromium
   ```

*(If you are on Linux and missing OS libraries, run: `npx playwright install --with-deps chromium`)*

---

## Instructions: How to Run

There are four ways to run TestPilot depending on your workflow:

### Method 1: All-In-One Automated CLI Demo (Recommended for quick testing)

The quickest way to see TestPilot in action. It automatically starts the target sample application, runs the complete autonomous pipeline (discovery, analysis, execution, evidence collection, codegen, reporting), and stops the application when finished.

```bash
npm run demo
```

**What to expect:**
```text
{"totalScenarios":3,"passed":2,"failed":1,"errors":0,"confirmedBugs":1,"status":"completed_with_findings"}

Evidence report written to .../artifacts/latest/report.html
Scenarios: 3 | Passed: 2 | Failed: 1 | Bugs: 1
```

Generated artifacts will be created in `artifacts/latest/`:
- `artifacts/latest/report.html` — Interactive visual evidence report.
- `artifacts/latest/result.json` — Machine-readable run outcome and bug details.
- `artifacts/latest/plan.json` — Generated test plan with discovered selectors.
- `artifacts/latest/screenshots/` — Step-by-step full-page screenshots.
- `generated/registration-flow.spec.js` — Standalone Playwright test.

---

### Method 2: Mission Control Web Dashboard

The web UI provides real-time visibility into the agent's live execution steps, pipeline stage transitions, and confirmed findings.

#### Step 1: Start the sample application (Terminal 1)
```bash
npm run start:app
```
*Application runs at:* `http://127.0.0.1:4173`

#### Step 2: Start the dashboard server (Terminal 2)
```bash
npm run start:dashboard
```
*Dashboard runs at:* `http://127.0.0.1:4300`

#### Step 3: Run a mission from the browser
1. Open your browser and navigate to **`http://127.0.0.1:4300`**.
2. Keep the default application URL (`http://127.0.0.1:4173`) or enter your target URL.
3. Review or edit the Acceptance Criteria (e.g. *"The registration flow should only create an account when the password and confirmation password match."*).
4. Click **Start QA mission**.
5. Watch the real-time stage progression:
   - **Discover**: Crawls the app and extracts forms, inputs, and indicators.
   - **Analyze**: Synthesizes P0/P1/P2 scenarios.
   - **Execute**: Drives Playwright and tests each scenario.
   - **Evidence**: Collects screenshots and logs.
   - **Done**: Summarizes findings.
6. Click **Open evidence report →** to open the full HTML evidence report.

---

### Method 3: Running the Generated Playwright Regression Suite

TestPilot automatically synthesizes clean, independently runnable Playwright test files based on the verified positive customer journeys.

To run the generated regression test:
```bash
npm run test:generated
```

**Expected output:**
```text
Running 1 test using 1 worker

  ✓ Complete registration with valid data (499ms)

  1 passed (1.8s)
```

The generated spec is located at:
`generated/registration-flow.spec.js`

---

### Method 4: CLI Runner (Direct Execution)

If you already have the target application running, you can run the autonomous QA runner directly from the terminal:

```bash
# Target default local app (http://127.0.0.1:4173)
npm run qa

# Or override target URL and custom artifact directory:
APP_URL=http://127.0.0.1:4173 ARTIFACT_DIR=artifacts/custom-run npm run qa
```

---

## Viewing the Evidence Report

After any run, open the generated HTML report in your browser:

- **Linux**:
  ```bash
  xdg-open artifacts/latest/report.html
  ```
- **macOS**:
  ```bash
  open artifacts/latest/report.html
  ```
- **Windows**:
  ```bash
  start artifacts/latest/report.html
  ```

The report includes:
- Summary metrics (total scenarios, passed, failed, confirmed bugs).
- Confirmed bugs with severity, confidence rating (95%), full reproduction steps, expected vs. actual outcomes, deterministic assertions, and screenshot proof.
- Complete step-by-step execution tables for every scenario with status badges and evidence links.

---

## API Usage

When the dashboard server is running (`npm run start:dashboard`), you can also trigger and inspect runs via REST API:

### 1. Trigger a new QA mission
```bash
curl -X POST http://127.0.0.1:4300/api/runs \
  -H 'Content-Type: application/json' \
  -d '{
    "appUrl": "http://127.0.0.1:4173",
    "description": "The registration flow should only create an account when the password and confirmation password match."
  }'
```

Response:
```json
{
  "id": "e4f8b2d1-...",
  "status": "queued",
  "progress": 0
}
```

### 2. Poll run status
```bash
curl http://127.0.0.1:4300/api/runs/<RUN_ID>
```

### 3. Open run report
```text
http://127.0.0.1:4300/api/runs/<RUN_ID>/report
```

---

## Target Application & Seeded Defect

The sample application in `sample-app/server.js` is the **Meridian** workspace registration flow.

### The Seeded Defect:
While the registration page collects both `Password` and `Confirm password`, the backend accepts the registration even when the confirmation password does **not** match the initial password.

### How TestPilot Accurately Catches It:
1. **Discovery**: Locates the form fields (`name`, `email`, `password`, `confirm-password`, `terms`) and submit button (`create-account`).
2. **Analysis**: Synthesizes a high-priority (`P0`) negative test scenario with mismatched passwords based on the acceptance criteria keywords.
3. **Execution**: Submits the registration with `"SecurePass123!"` and `"DifferentPass456!"`.
4. **Assertion**: Scans for success vs. error indicators. Detects `<h1 data-testid="registration-success">Welcome to Meridian</h1>`, proving the invalid submission was mistakenly accepted.
5. **Reporting**: Documents the finding with full reproduction steps, deterministic assertion `assert_form_rejected(page)`, and screenshot evidence.
6. **False-Positive Elimination**: Correctly verifies that empty submissions are rejected by client-side HTML5 validation, reporting 0 false alarms.

---

## Troubleshooting

- **`playwright: command not found` or browser launch failure:**
  Run `npx playwright install chromium` (or with system deps: `npx playwright install --with-deps chromium`).
- **Connection refused to `http://127.0.0.1:4173`:**
  Make sure the sample application is running (`npm run start:app`). If running `npm run demo`, it starts and stops the app automatically.
- **Port already in use (`4173` or `4300`):**
  Specify a custom port:
  ```bash
  PORT=4180 npm run start:app
  PORT=4310 npm run start:dashboard
  ```
