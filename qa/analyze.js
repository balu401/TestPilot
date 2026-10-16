/**
 * Analysis engine — takes a discovered site map and the user's acceptance
 * criteria, then generates concrete test scenarios.
 *
 * The engine works by:
 * 1. Extracting keywords from the description to understand intent
 * 2. Deduplicating forms across pages so identical forms aren't tested redundantly
 * 3. Classifying each unique form (registration, login, search, etc.)
 * 4. Generating positive + negative + boundary scenarios per form
 * 5. Assigning priorities based on description relevance
 */

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

  if (type === "checkbox") return true; // will be handled as check action
  if (type === "email") return variant === "invalid" ? TEST_DATA.invalidEmail : TEST_DATA.email;
  if (type === "password") {
    if (variant === "mismatched") return TEST_DATA.mismatchedPassword;
    if (variant === "short") return TEST_DATA.shortPassword;
    return TEST_DATA.password;
  }
  if (type === "tel") return TEST_DATA.phone;
  if (type === "url") return TEST_DATA.url;
  if (type === "number") return TEST_DATA.number;

  // Name heuristics
  if (key.includes("name") && !key.includes("user")) return TEST_DATA.name;
  if (key.includes("user")) return "testuser";

  // Placeholder hint
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

/**
 * Build fill + check steps for every field in a form.
 * `variant` controls how password/email fields are filled.
 */
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
    // For mismatched variant, only the confirm-password field gets the mismatch
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

  // Click submit
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

/**
 * Generate scenarios for a registration form.
 */
function registrationScenarios(form, page, keywords) {
  const scenarios = [];
  const pageUrl = page.url;

  const passwordFields = form.fields.filter(
    (f) => f.type === "password" || (f.name || f.testId || "").toLowerCase().includes("password")
  );
  const hasConfirmPassword = passwordFields.length >= 2;

  // ---- Negative: mismatched passwords (P0 if description mentions it) ----
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
      steps,
      expectedOutcome: "The form rejects the submission and shows a validation error because the passwords do not match.",
    });
  }

  // ---- Positive: valid registration (P1) ----
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
      steps,
      expectedOutcome: "The account is created and a success confirmation is displayed.",
    });
  }

  // ---- Boundary: empty required fields (P2) ----
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
      steps,
      expectedOutcome: "The form rejects the submission because required fields are empty.",
    });
  }

  return scenarios;
}

/**
 * Generate scenarios for a login form.
 */
function loginScenarios(form, page, keywords) {
  const scenarios = [];
  const pageUrl = page.url;

  // Positive: valid login
  {
    const steps = buildFormFillSteps(form, pageUrl, "valid");
    steps.push({ action: "assert_form_accepted", description: "Login should be processed" });
    scenarios.push({
      id: nextId("login-valid"),
      title: "Submit login with credentials",
      type: "positive",
      priority: "P1",
      steps,
      expectedOutcome: "The login form is submitted and the page responds.",
    });
  }

  // Negative: empty submission
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
      steps,
      expectedOutcome: "The form rejects the submission because credentials are missing.",
    });
  }

  return scenarios;
}

/**
 * Generate scenarios for a generic form.
 */
function genericFormScenarios(form, page, keywords) {
  const scenarios = [];
  const pageUrl = page.url;

  // Positive: fill and submit
  {
    const steps = buildFormFillSteps(form, pageUrl, "valid");
    steps.push({ action: "assert_form_accepted", description: "Form should accept valid input" });
    scenarios.push({
      id: nextId("form-valid"),
      title: `Submit ${form.testId || "form"} with valid data`,
      type: "positive",
      priority: "P1",
      steps,
      expectedOutcome: "The form accepts the submission.",
    });
  }

  // Boundary: empty required fields
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
 * Forms are deduplicated across routes to prevent redundant duplicate testing.
 */
function analyzeForTesting(siteMapData, description) {
  scenarioCounter = 0;
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

  // Sort by priority: P0 first, then P1, then P2
  scenarios.sort((a, b) => a.priority.localeCompare(b.priority));

  return scenarios;
}

module.exports = { analyzeForTesting, extractKeywords, classifyForm, formSignature };
