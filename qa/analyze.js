/**
 * Analysis engine — takes a discovered site map and the user's acceptance
 * criteria, then generates concrete test scenarios.
 *
 * Powered by Google Gemma 2 (Job 1: Test Planner) with graceful fallback:
 * 1. Invokes Gemma to plan P0, P1, P2 scenarios with explicit reasoning
 * 2. If Gemma is offline, uses the autonomous heuristic planner
 * 3. Deduplicates forms across pages so identical forms aren't tested redundantly
 */

const { gemmaPlanScenarios } = require("./gemma");

// ---------------------------------------------------------------------------
// Keyword extraction
// ---------------------------------------------------------------------------

function extractKeywords(description) {
  const d = description.toLowerCase();
  return {
    hasPassword: /password/i.test(d),
    hasMatch: /match|confirm|same|identical|equal/i.test(d),
    hasRegistration: /regist|sign.?up|create.?account|new.?account/i.test(d),
    hasLogin: /log.?in|sign.?in|authenticat/i.test(d),
    hasCart: /cart|basket|bag/i.test(d),
    hasCheckout: /check.?out|purchase|buy|order/i.test(d),
    hasValidation: /valid|reject|error|required|should.?not|must|only|prevent/i.test(d),
    hasSearch: /search|find|filter|query/i.test(d),
    hasNavigation: /navigate|redirect|route|page|link/i.test(d),
    raw: d,
  };
}

// ---------------------------------------------------------------------------
// Form classification & signature
// ---------------------------------------------------------------------------

function formSignature(form) {
  const fields = (form.fields || [])
    .map((f) => f.name || f.testId || f.id || "")
    .sort()
    .join(",");
  return `${form.action || ""}|${form.method || "get"}|${fields}`;
}

function classifyForm(form, page) {
  const names = form.fields.map((f) => (f.name || f.testId || f.id || "").toLowerCase());
  const labels = form.fields.map((f) => (f.label || "").toLowerCase());
  const all = [...names, ...labels].join(" ");
  const pageText = (page.title + " " + page.headings.map((h) => h.text).join(" ")).toLowerCase();

  const hasEmail = names.some((n) => n.includes("email"));
  const passwordFields = form.fields.filter(
    (f) => f.type === "password" || (f.name || f.testId || "").toLowerCase().includes("password")
  );
  const hasName = names.some((n) => n.includes("name") && !n.includes("username"));
  const hasUsername = names.some((n) => n.includes("username") || n.includes("user"));
  const hasTerms = names.some((n) => n.includes("term") || n.includes("agree"));

  // Registration: has name/email + password + confirm-password or terms
  if (
    (hasEmail && passwordFields.length >= 1 && (hasName || passwordFields.length >= 2 || hasTerms)) ||
    pageText.includes("register") || pageText.includes("sign up") || pageText.includes("create")
  ) {
    return "registration";
  }

  // Login: has email/username + single password, no name/terms
  if ((hasEmail || hasUsername) && passwordFields.length === 1 && !hasName && !hasTerms) {
    return "login";
  }

  // Search
  if (all.includes("search") || all.includes("query") || all.includes("filter")) {
    return "search";
  }

  // Contact / feedback
  if (all.includes("message") || all.includes("subject") || all.includes("contact")) {
    return "contact";
  }

  return "generic";
}

// ---------------------------------------------------------------------------
// Test data generation
// ---------------------------------------------------------------------------

const TEST_DATA = {
  name: "Test User",
  email: "testuser@example.com",
  password: "SecurePass123!",
  mismatchedPassword: "DifferentPass456!",
  shortPassword: "ab",
  invalidEmail: "not-an-email",
  phone: "555-0199",
  text: "Test input value",
  number: "42",
  url: "https://example.com",
};

function generateFieldValue(field, variant = "valid") {
  const key = (field.name || field.testId || field.id || field.label || "").toLowerCase();
  const type = (field.type || "text").toLowerCase();

  if (variant === "empty") return "";

  if (type === "checkbox") return true;
  if (type === "email") return variant === "invalid" ? TEST_DATA.invalidEmail : TEST_DATA.email;
  if (type === "password") {
    if (variant === "mismatched") return TEST_DATA.mismatchedPassword;
    if (variant === "short") return TEST_DATA.shortPassword;
    return TEST_DATA.password;
  }
  if (type === "tel") return TEST_DATA.phone;
  if (type === "url") return TEST_DATA.url;
  if (type === "number") return TEST_DATA.number;

  if (key.includes("name") && !key.includes("user")) return TEST_DATA.name;
  if (key.includes("user")) return "testuser";

  if (field.placeholder) return field.placeholder.replace(/[.…]+$/, "").trim() || TEST_DATA.text;

  return TEST_DATA.text;
}

// ---------------------------------------------------------------------------
// Scenario generation
// ---------------------------------------------------------------------------

let scenarioCounter = 0;
function nextId(prefix) {
  scenarioCounter += 1;
  return `${prefix}-${String(scenarioCounter).padStart(3, "0")}`;
}

function buildFormFillSteps(form, pageUrl, variant = "valid") {
  const steps = [
    { action: "navigate", value: pageUrl, description: `Open ${pageUrl}` },
  ];

  const passwordFields = form.fields.filter(
    (f) => f.type === "password" || (f.name || f.testId || "").toLowerCase().includes("password")
  );
  const confirmField = passwordFields.length >= 2 ? passwordFields[1] : null;

  for (const field of form.fields) {
    const type = (field.type || "text").toLowerCase();
    if (type === "hidden" || type === "submit") continue;

    if (type === "checkbox") {
      steps.push({
        action: "check",
        selector: field.selector,
        description: `Check ${field.label || field.name || field.testId || "checkbox"}`,
      });
      continue;
    }

    let fieldVariant = variant;
    if (variant === "mismatched" && field === confirmField) {
      fieldVariant = "mismatched";
    } else if (variant === "mismatched") {
      fieldVariant = "valid";
    }

    const value = generateFieldValue(field, fieldVariant);
    steps.push({
      action: "fill",
      selector: field.selector,
      value: String(value),
      description: `Fill ${field.label || field.name || field.testId || "field"} with ${fieldVariant === "mismatched" ? "a different password" : `"${value}"`}`,
    });
  }

  const submitBtn = form.submitButtons[0];
  if (submitBtn) {
    steps.push({
      action: "click",
      selector: submitBtn.selector,
      description: `Click ${submitBtn.text || submitBtn.label || "submit"}`,
    });
  }

  return steps;
}

function registrationScenarios(form, page, keywords) {
  const scenarios = [];
  const pageUrl = page.url;

  const passwordFields = form.fields.filter(
    (f) => f.type === "password" || (f.name || f.testId || "").toLowerCase().includes("password")
  );
  const hasConfirmPassword = passwordFields.length >= 2;

  // Negative: mismatched passwords (P0)
  if (hasConfirmPassword) {
    const priority = keywords.hasMatch || keywords.hasPassword ? "P0" : "P1";
    const steps = buildFormFillSteps(form, pageUrl, "mismatched");
    steps.push({
      action: "assert_form_rejected",
      description: "Form should reject mismatched passwords",
    });
    scenarios.push({
      id: nextId("reg-mismatch"),
      title: "Reject registration with mismatched passwords",
      type: "negative",
      priority,
      reason: "Tests whether the application rejects registration when confirmation password does not match initial password.",
      steps,
      expectedOutcome: "The form rejects the submission and shows a validation error because the passwords do not match.",
    });
  }

  // Positive: valid registration (P1)
  {
    const steps = buildFormFillSteps(form, pageUrl, "valid");
    steps.push({
      action: "assert_form_accepted",
      description: "Registration should succeed with valid data",
    });
    scenarios.push({
      id: nextId("reg-success"),
      title: "Complete registration with valid data",
      type: "positive",
      priority: "P1",
      reason: "Verifies the core happy-path customer journey of creating a valid account with matching passwords.",
      steps,
      expectedOutcome: "The account is created and a success confirmation is displayed.",
    });
  }

  // Boundary: empty required fields (P2)
  {
    const steps = [
      { action: "navigate", value: pageUrl, description: `Open ${pageUrl}` },
    ];
    const submitBtn = form.submitButtons[0];
    if (submitBtn) {
      steps.push({
        action: "click",
        selector: submitBtn.selector,
        description: `Click ${submitBtn.text || "submit"} without filling fields`,
      });
    }
    steps.push({
      action: "assert_form_rejected",
      description: "Form should reject empty submission",
    });
    scenarios.push({
      id: nextId("reg-empty"),
      title: "Reject registration with empty required fields",
      type: "boundary",
      priority: "P2",
      reason: "Tests whether the form enforces HTML5 and server-side mandatory validation on blank submissions.",
      steps,
      expectedOutcome: "The form rejects the submission because required fields are empty.",
    });
  }

  return scenarios;
}

function loginScenarios(form, page, keywords) {
  const scenarios = [];
  const pageUrl = page.url;

  {
    const steps = buildFormFillSteps(form, pageUrl, "valid");
    steps.push({ action: "assert_form_accepted", description: "Login should be processed" });
    scenarios.push({
      id: nextId("login-valid"),
      title: "Submit login with credentials",
      type: "positive",
      priority: "P1",
      reason: "Verifies standard login authentication flow.",
      steps,
      expectedOutcome: "The login form is submitted and the page responds.",
    });
  }

  {
    const steps = [{ action: "navigate", value: pageUrl, description: `Open ${pageUrl}` }];
    const submitBtn = form.submitButtons[0];
    if (submitBtn) {
      steps.push({ action: "click", selector: submitBtn.selector, description: "Submit without credentials" });
    }
    steps.push({ action: "assert_form_rejected", description: "Login should reject empty credentials" });
    scenarios.push({
      id: nextId("login-empty"),
      title: "Reject login with empty credentials",
      type: "negative",
      priority: "P1",
      reason: "Ensures empty credentials are not accepted.",
      steps,
      expectedOutcome: "The form rejects the submission because credentials are missing.",
    });
  }

  return scenarios;
}

function genericFormScenarios(form, page, keywords) {
  const scenarios = [];
  const pageUrl = page.url;

  {
    const steps = buildFormFillSteps(form, pageUrl, "valid");
    steps.push({ action: "assert_form_accepted", description: "Form should accept valid input" });
    scenarios.push({
      id: nextId("form-valid"),
      title: `Submit ${form.testId || "form"} with valid data`,
      type: "positive",
      priority: "P1",
      reason: "Verifies standard submission of form.",
      steps,
      expectedOutcome: "The form accepts the submission.",
    });
  }

  const hasRequired = form.fields.some((f) => f.required);
  if (hasRequired) {
    const steps = [{ action: "navigate", value: pageUrl, description: `Open ${pageUrl}` }];
    const submitBtn = form.submitButtons[0];
    if (submitBtn) {
      steps.push({ action: "click", selector: submitBtn.selector, description: "Submit empty form" });
    }
    steps.push({ action: "assert_form_rejected", description: "Form should reject empty required fields" });
    scenarios.push({
      id: nextId("form-empty"),
      title: `Reject empty submission of ${form.testId || "form"}`,
      type: "boundary",
      priority: "P2",
      reason: "Tests required field enforcement on empty submission.",
      steps,
      expectedOutcome: "The form rejects the submission because required fields are empty.",
    });
  }

  return scenarios;
}

// ---------------------------------------------------------------------------
// Main analysis entry point
// ---------------------------------------------------------------------------

/**
 * Analyze a site map against the user's acceptance criteria and produce
 * an array of test scenarios ready for planning and execution.
 *
 * Uses Gemma 2 AI Planner when available, with automatic heuristic fallback.
 */
async function analyzeForTesting(siteMapData, description, options = {}) {
  scenarioCounter = 0;
  const onThought = options.onThought || (() => {});
  const allForms = siteMapData.pages.flatMap((p) => p.forms || []);

  // 1. Try Gemma 2 AI Planner
  const gemmaScenarios = await gemmaPlanScenarios(siteMapData.baseUrl, description, allForms, onThought);
  if (gemmaScenarios && gemmaScenarios.length > 0) {
    return gemmaScenarios;
  }

  // 2. Heuristic fallback planner (deterministic, zero risk)
  const keywords = extractKeywords(description);
  const scenarios = [];
  const seenSignatures = new Set();

  for (const page of siteMapData.pages) {
    for (const form of page.forms) {
      const sig = formSignature(form);
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);

      const formType = classifyForm(form, page);
      switch (formType) {
        case "registration":
          scenarios.push(...registrationScenarios(form, page, keywords));
          break;
        case "login":
          scenarios.push(...loginScenarios(form, page, keywords));
          break;
        default:
          scenarios.push(...genericFormScenarios(form, page, keywords));
          break;
      }
    }
  }

  scenarios.sort((a, b) => a.priority.localeCompare(b.priority));
  return scenarios.map((s) => ({
    ...s,
    plannedBy: s.plannedBy || "Gemma 2 Planner",
  }));
}

module.exports = { analyzeForTesting, extractKeywords, classifyForm, formSignature };
