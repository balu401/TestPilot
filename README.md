# Autonomous AI QA Engineer — TestPilot AI

> **Autonomous QA Agent powered by Google Gemma 2 open models & Playwright.**
> Built for the Hacktoberfest Hackathon — targeting **Best Use of Gemma** (Google DeepMind) and **Best Open-Source AI Project** (DigitalOcean).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Gemma 2](https://img.shields.io/badge/Model-Gemma--2--9B--IT-purple.svg)](https://ai.google.dev/gemma)
[![Playwright](https://img.shields.io/badge/Runner-Playwright--Chromium-orange.svg)](https://playwright.dev/)

---

## What is TestPilot AI?

TestPilot is an autonomous AI QA engineer that replaces brittle, hardcoded test scripts with continuous intelligent quality assurance. 

Given only a web application URL and high-level human acceptance criteria:
1. **Autonomous DOM Discovery**: Crawls the application and maps interactive elements, forms, and status indicators without hardcoded selectors.
2. **Gemma 2 Test Planner (Job 1)**: Synthesizes a high-impact test matrix (P0 defect-hunting negative paths, P1 happy paths, P2 boundary tests) with explicit reasoning for every scenario.
3. **Playwright Execution**: Drives real headless Chromium, executing steps and capturing console logs and full-page screenshots at every turn.
4. **Gemma Multimodal Visual Verifier (Job 2)**: Visually inspects application screenshots to catch UI regressions and deceptive states.
5. **Gemma Failure Investigator (Job 3)**: Triages unexpected behaviors, categorizing failures into `confirmed_bug`, `automation_error`, or `environment_failure`.
6. **Gemma Bug Report Writer (Job 4)**: Diagnoses the technical root cause and provides recommended 1-3 line code fixes for backend developers.
7. **Regression Test Codegen**: Automatically synthesizes standalone, production-ready `@playwright/test` specs from verified paths.
8. **Interactive Evidence Dossier**: Generates an audit-grade HTML report with deterministic reproduction protocols and visual proof.

---

## 4 Gemma QA Jobs Architecture

```text
               User Acceptance Criteria + Target URL
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. DOM CRAWLER & DISCOVERY ENGINE (qa/discover.js)          │
│    Maps forms, inputs, submit buttons, and status elements   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Discovered Forms + Criteria
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. GEMMA TEST PLANNER [Job 1] (qa/analyze.js + qa/gemma.js) │
│    Synthesizes P0 Negative, P1 Positive, P2 Boundary tests  │
│    Attaches explicit "Why Gemma planned this" reasoning     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Structured Test Plan
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PLAYWRIGHT CHROMIUM RUNNER (qa/execute.js)                │
│    Drives real browser actions and captures proof           │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Pass                          │ Assertion Failure
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│ REGRESSION CODEGEN           │ │ 4. GEMMA VISUAL VERIFIER    │
│ (qa/codegen.js)              │ │    [Job 2] (qa/gemma.js)    │
│ Synthesizes standalone       │ │    Multimodal screenshot    │
│ Playwright regression specs  │ │    inspection               │
└──────────────┬───────────────┘ └─────────────┬───────────────┘
               │                               ▼
               │                 ┌─────────────────────────────┐
               │                 │ 5. GEMMA FAILURE TRIAGE     │
               │                 │    [Job 3] (qa/gemma.js)    │
               │                 │    Classifies: Bug vs       │
               │                 │    Automation Error         │
               │                 └─────────────┬───────────────┘
               │                               ▼
               │                 ┌─────────────────────────────┐
               │                 │ 6. GEMMA BUG DIAGNOSER      │
               │                 │    [Job 4] (qa/gemma.js)    │
               │                 │    Synthesizes Root Cause   │
               │                 │    and Developer Code Fix   │
               │                 └─────────────┬───────────────┘
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. MISSION EVIDENCE DOSSIER & DASHBOARD TELEMETRY           │
│    Dual-stream live telemetry, root-cause card, HTML audit   │
└─────────────────────────────────────────────────────────────┘
```

---

## Live Mission Control Dashboard

The Mission Control dashboard (`dashboard/index.html`) features:
- **Dual-Stream Live Console**:
  - **Left Stream**: Live Browser Telemetry (Playwright: `[NAVIGATE]`, `[FILL]`, `[CLICK]`, `[ASSERT]`).
  - **Right Stream**: Gemma Reasoning Stream (`[GEMMA:PLAN]`, `[GEMMA:EXECUTE]`, `[GEMMA:VERIFY]`, `[GEMMA:CLASSIFY]`, `[GEMMA:DIAGNOSE]`).
- **Gemma Model Header & Counter**: Live badge displaying active Gemma model and inference call counter.
- **Defect Dossier with "Why?" Drawer**: Shows expected vs observed, visual verification verdict, failure classification with confidence rating, technical root cause, and copy-pasteable code fix.
- **Synthesized Test Matrix**: Live cards for all synthesized scenarios showing priority, step count, and Gemma's explicit rationale.
- **Synthesized Playwright Spec**: Real-time viewer with 1-click clipboard copy.

---

## Setup & Configuration

### 1. Prerequisites
- **Node.js**: v18.0.0 or newer (built and verified on Node v26)
- **npm**: v9 or newer
- **Chromium browser**: Installed via Playwright

```bash
# Clone the repository
git clone https://github.com/balaji-s-repo/TestPilot.git
cd TestPilot

# Install dependencies
npm install

# Install Playwright browser binary
npx playwright install chromium
```

### 2. Environment Variables & Gemma Backend

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

TestPilot supports three flexible Gemma backends:

#### Option A: Google Gemini API (Recommended for Hosted Gemma)
Obtain a free Google AI Studio key at [ai.google.dev](https://ai.google.dev/):
```env
GEMINI_API_KEY=your_google_ai_studio_api_key_here
GEMMA_MODEL=gemma-2-9b-it
```
*(Also supports `gemma-2-27b-it` or preview models).*

#### Option B: Local Ollama (100% Offline & Open-Weights)
If you prefer running open weights on your local machine or GPU:
```bash
ollama run gemma2:9b
```
In your `.env`:
```env
OLLAMA_HOST=http://localhost:11434
GEMMA_MODEL=gemma2:9b
```

#### Option C: Resilient Autonomous Heuristic Fallback
If no API key or local Ollama host is found, TestPilot's intelligent fallback engine takes over seamlessly. **It guarantees 0 crashes and 0 demo failures during live stage presentations.**

---

## Running TestPilot AI

### Method 1: Automated 10-Second Demo (Recommended for Judges)
Starts the target app, runs the full Gemma pipeline, catches the defect, generates regression tests, and writes the HTML dossier:
```bash
npm run demo
```

### Method 2: Mission Control Web Dashboard
```bash
# Terminal 1: Start sample application
npm run start:app

# Terminal 2: Start Mission Control Dashboard
npm run start:dashboard
```
Open **`http://127.0.0.1:4300`** in your browser and click **⚡ INITIATE MISSION**.

### Method 3: Run Generated Regression Tests
TestPilot writes standalone `@playwright/test` specs from verified paths:
```bash
npm run test:generated
```

### Method 4: Direct CLI Execution
```bash
npm run qa
```

---

## Planted Defect Verification

The included demo application (`sample-app/server.js`) simulates the **Meridian** SaaS workspace registration.

- **The Bug**: The registration form collects `password` and `confirmPassword`, but the backend handler fails to verify they match.
- **How Gemma Catches It**:
  1. *Planner*: Detects confirmation field and synthesizes P0 scenario with mismatched passwords (`"SecurePass123!"` vs `"DifferentPass456!"`).
  2. *Executor*: Submits the form and captures evidence.
  3. *Visual Verifier & Triage*: Gemma detects `<h1 data-testid="registration-success">Welcome to Meridian</h1>`, notes that an invalid submission was accepted, and classifies it as `confirmed_bug` (95% confidence).
  4. *Bug Report Writer*: Diagnoses root cause:
     > `"Backend registration handler does not compare 'password' with 'confirmPassword' before creating account."`
     And provides the fix:
     > `if (req.body.password !== req.body.confirmPassword) return res.status(400).send('Passwords must match.');`

---

## Repository Structure

```text
├── api/
│   └── server.js          # Mission Control server & REST endpoints
├── dashboard/
│   ├── index.html         # Cyberpunk Mission Control UI with Dual Log Streams
│   └── favicon.svg        # Brand icon
├── qa/
│   ├── gemma.js           # Gemma AI Client (Jobs 1–4, Gemini API & Ollama)
│   ├── analyze.js         # Intelligent Scenario Synthesizer (P0/P1/P2)
│   ├── discover.js        # Dynamic DOM Crawler & Structure Mapper
│   ├── execute.js         # Generic Playwright Step Executor & Visual Verifier
│   ├── assert.js          # Deterministic High-Precision Assertion Oracle
│   ├── codegen.js         # Playwright Spec Generator
│   ├── evidence.js        # Screenshots, DOM Snapshots & Console Logs
│   ├── report.js          # HTML Evidence Dossier Generator
│   ├── schemas.js         # Zod Contract Validation Schemas
│   ├── run.js             # Pipeline Orchestrator
│   └── demo.js            # Automated End-to-End Demo Script
├── sample-app/
│   └── server.js          # Meridian Demo Web App with Seeded Defect
├── generated/             # Synthesized standalone Playwright regression specs
├── .env.example           # Environment template (Gemini API & Ollama)
├── LICENSE                # MIT License
└── package.json
```

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
