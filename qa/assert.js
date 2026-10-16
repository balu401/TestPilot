/**
 * Assertion library — provides high-precision post-action checks that scan
 * the live page for success and error indicators.
 *
 * Designed for accuracy:
 *   - Strictly ignores input fields, labels, buttons, and form wrappers to
 *     prevent false positives (e.g. matching "Confirm password" label as "confirm").
 *   - Checks HTML5 client-side validation states (input:invalid).
 *   - Accurately captures the exact selector that verified success so
 *     generated Playwright tests can assert on it.
 */

function selectorFor(el) {
  const testId = el.getAttribute("data-testid");
  if (testId) return { strategy: "testid", value: testId };
  const id = el.getAttribute("id");
  if (id) return { strategy: "id", value: `#${id}` };
  const tag = el.tagName.toLowerCase();
  const cls = el.className ? `.${el.className.trim().split(/\s+/)[0]}` : "";
  if (cls) return { strategy: "css", value: `${tag}${cls}` };
  return { strategy: "css", value: tag };
}

/**
 * Scan the current page for genuine success indicators.
 * Returns an array of { testId, text, visible, selector } objects.
 */
async function scanForSuccessIndicators(page) {
  return page.evaluate(() => {
    function selectorFor(el) {
      const testId = el.getAttribute("data-testid");
      if (testId) return { strategy: "testid", value: testId };
      const id = el.getAttribute("id");
      if (id) return { strategy: "id", value: `#${id}` };
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/)[0]}` : "";
      if (cls) return { strategy: "css", value: `${tag}${cls}` };
      return { strategy: "css", value: tag };
    }

    const EXCLUDED_TAGS = new Set(["FORM", "INPUT", "TEXTAREA", "SELECT", "LABEL", "BUTTON", "BODY", "HTML", "NAV", "FOOTER"]);
    const results = [];
    const seen = new Set();

    // 1. Look for explicit success testids
    const successTestIdEls = document.querySelectorAll(
      '[data-testid*="success"], [data-testid*="confirmation"], [data-testid*="confirmed"], [data-testid*="thank"]'
    );
    for (const el of successTestIdEls) {
      if (EXCLUDED_TAGS.has(el.tagName)) continue;
      const testId = el.getAttribute("data-testid") || "";
      if (/password|email|name|term|input|button|submit|form/i.test(testId)) continue;
      const visible = (el.offsetParent !== null || el.getClientRects().length > 0) && el.textContent.trim().length > 0;
      if (visible && !seen.has(el)) {
        seen.add(el);
        results.push({
          testId,
          text: el.textContent.trim().substring(0, 150),
          visible: true,
          selector: selectorFor(el),
        });
      }
    }

    // 2. Look for role="status" or success classes
    const statusEls = document.querySelectorAll(
      '[role="status"], .success:not(form):not(input), .alert-success, .confirmation:not(form)'
    );
    for (const el of statusEls) {
      if (EXCLUDED_TAGS.has(el.tagName)) continue;
      const visible = (el.offsetParent !== null || el.getClientRects().length > 0) && el.textContent.trim().length > 0;
      if (visible && !seen.has(el)) {
        seen.add(el);
        results.push({
          testId: el.getAttribute("data-testid") || undefined,
          text: el.textContent.trim().substring(0, 150),
          visible: true,
          selector: selectorFor(el),
        });
      }
    }

    // 3. Look for prominent headings indicating completion
    const headings = document.querySelectorAll("h1, h2");
    const headingPattern = /\b(welcome|thank you|thanks|account created|order confirmed|successfully created|workspace is ready)\b/i;
    for (const el of headings) {
      if (headingPattern.test(el.textContent)) {
        const visible = (el.offsetParent !== null || el.getClientRects().length > 0) && el.textContent.trim().length > 0;
        if (visible && !seen.has(el)) {
          seen.add(el);
          results.push({
            testId: el.getAttribute("data-testid") || undefined,
            text: el.textContent.trim().substring(0, 150),
            visible: true,
            selector: selectorFor(el),
          });
        }
      }
    }

    return results;
  });
}

/**
 * Scan the current page for genuine error indicators with visible text.
 */
async function scanForErrorIndicators(page) {
  return page.evaluate(() => {
    function selectorFor(el) {
      const testId = el.getAttribute("data-testid");
      if (testId) return { strategy: "testid", value: testId };
      const id = el.getAttribute("id");
      if (id) return { strategy: "id", value: `#${id}` };
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/)[0]}` : "";
      if (cls) return { strategy: "css", value: `${tag}${cls}` };
      return { strategy: "css", value: tag };
    }

    const EXCLUDED_TAGS = new Set(["FORM", "BODY", "HTML", "NAV", "FOOTER"]);
    const results = [];
    const seen = new Set();

    const candidates = document.querySelectorAll(
      '[role="alert"], .form-error, .invalid-feedback, .alert-danger, .alert-error, .error-message, [data-testid*="error"], [data-testid*="invalid"]'
    );

    for (const el of candidates) {
      if (EXCLUDED_TAGS.has(el.tagName)) continue;
      const text = el.textContent ? el.textContent.trim() : "";
      // Error element must have actual text content to be an active error!
      if (!text) continue;
      const visible = el.offsetParent !== null || el.getClientRects().length > 0;
      if (visible && !seen.has(el)) {
        seen.add(el);
        results.push({
          testId: el.getAttribute("data-testid") || undefined,
          text: text.substring(0, 150),
          visible: true,
          selector: selectorFor(el),
        });
      }
    }

    return results;
  });
}

/**
 * Check if the browser's HTML5 client-side form validation blocked submission.
 */
async function checkClientValidation(page) {
  return page.evaluate(() => {
    const invalidInputs = Array.from(
      document.querySelectorAll("input:invalid, select:invalid, textarea:invalid")
    );
    return {
      hasInvalidFields: invalidInputs.length > 0,
      invalidFieldNames: invalidInputs.map(
        (el) => el.getAttribute("name") || el.getAttribute("data-testid") || el.id || el.tagName
      ),
    };
  });
}

/**
 * Assert that a form submission was REJECTED (negative test).
 *
 * Returns { pass: boolean, actual: string, details: object }.
 */
async function assertFormRejected(page, preSubmitUrl) {
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 4000 });
  } catch { /* proceed */ }
  await page.waitForTimeout(300);

  const currentUrl = page.url();
  const urlChanged = currentUrl !== preSubmitUrl;
  const visibleSuccess = await scanForSuccessIndicators(page);
  const visibleErrors = await scanForErrorIndicators(page);
  const clientValidation = await checkClientValidation(page);

  // If a success indicator appeared, the invalid submission was mistakenly ACCEPTED
  if (visibleSuccess.length > 0) {
    return {
      pass: false,
      actual: `Form was accepted when it should have been rejected. Success indicator found: "${visibleSuccess[0].text}"`,
      details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
    };
  }

  // If visible error indicators appeared, the form correctly rejected
  if (visibleErrors.length > 0) {
    return {
      pass: true,
      actual: `Form correctly rejected with validation error: "${visibleErrors[0].text}"`,
      details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
    };
  }

  // If HTML5 client validation blocked submission
  if (clientValidation.hasInvalidFields) {
    return {
      pass: true,
      actual: `Form submission blocked by client-side HTML5 validation (invalid fields: ${clientValidation.invalidFieldNames.join(", ")}).`,
      details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
    };
  }

  // If URL stayed the same and no success appeared
  if (!urlChanged) {
    return {
      pass: true,
      actual: "Form submission did not proceed; stayed on page without acceptance.",
      details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
    };
  }

  // Navigated away with no success indicator and no error
  return {
    pass: false,
    actual: `Page navigated to ${currentUrl} after invalid submission without displaying validation feedback.`,
    details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
  };
}

/**
 * Assert that a form submission was ACCEPTED (positive test).
 *
 * Returns { pass: boolean, actual: string, successSelector?: object, details: object }.
 */
async function assertFormAccepted(page, preSubmitUrl) {
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 4000 });
  } catch { /* proceed */ }
  await page.waitForTimeout(300);

  const currentUrl = page.url();
  const urlChanged = currentUrl !== preSubmitUrl;
  const visibleSuccess = await scanForSuccessIndicators(page);
  const visibleErrors = await scanForErrorIndicators(page);
  const clientValidation = await checkClientValidation(page);

  // Success indicator visible
  if (visibleSuccess.length > 0) {
    return {
      pass: true,
      actual: `Form accepted. Success indicator: "${visibleSuccess[0].text}"`,
      successSelector: visibleSuccess[0].selector,
      details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
    };
  }

  // URL changed and no errors
  if (urlChanged && visibleErrors.length === 0 && !clientValidation.hasInvalidFields) {
    return {
      pass: true,
      actual: `Form accepted; navigated to ${currentUrl}.`,
      details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
    };
  }

  // Visible error indicator
  if (visibleErrors.length > 0) {
    return {
      pass: false,
      actual: `Form was rejected with error: "${visibleErrors[0].text}"`,
      details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
    };
  }

  // Blocked by client validation
  if (clientValidation.hasInvalidFields) {
    return {
      pass: false,
      actual: `Form submission blocked by client-side validation on: ${clientValidation.invalidFieldNames.join(", ")}`,
      details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
    };
  }

  return {
    pass: false,
    actual: "No success indicator or navigation detected after form submission.",
    details: { urlChanged, visibleSuccess, visibleErrors, clientValidation },
  };
}

/**
 * Assert that an element matching `selectorStrategy` is visible on the page.
 */
async function assertVisible(page, selectorStrategy) {
  const locator = resolveLocator(page, selectorStrategy);
  try {
    await locator.waitFor({ state: "visible", timeout: 5000 });
    const text = await locator.textContent().catch(() => "");
    return { pass: true, actual: `Element is visible: "${(text || "").trim().substring(0, 100)}"` };
  } catch {
    return { pass: false, actual: `Element not visible: ${selectorStrategy.strategy}="${selectorStrategy.value}"` };
  }
}

/**
 * Assert that an element matching `selectorStrategy` is NOT visible.
 */
async function assertHidden(page, selectorStrategy) {
  const locator = resolveLocator(page, selectorStrategy);
  const visible = await locator.isVisible().catch(() => false);
  if (!visible) {
    return { pass: true, actual: "Element is not visible (as expected)." };
  }
  const text = await locator.textContent().catch(() => "");
  return { pass: false, actual: `Element is unexpectedly visible: "${(text || "").trim().substring(0, 100)}"` };
}

/**
 * Assert that an element's text contains a substring.
 */
async function assertTextContains(page, selectorStrategy, expected) {
  const locator = resolveLocator(page, selectorStrategy);
  try {
    const text = await locator.textContent({ timeout: 5000 });
    if ((text || "").includes(expected)) {
      return { pass: true, actual: `Text contains "${expected}".` };
    }
    return { pass: false, actual: `Text "${(text || "").trim()}" does not contain "${expected}".` };
  } catch {
    return { pass: false, actual: `Element not found for text check.` };
  }
}

/**
 * Map a selector strategy to a Playwright locator.
 */
function resolveLocator(page, sel) {
  switch (sel.strategy) {
    case "testid": return page.getByTestId(sel.value);
    case "id": return page.locator(sel.value);
    case "name": return page.locator(`[name="${sel.value}"]`);
    case "role": return page.getByRole(sel.value);
    case "label": return page.getByLabel(sel.value);
    case "text": return page.getByText(sel.value);
    case "css": return page.locator(sel.value);
    default: return page.locator(sel.value);
  }
}

module.exports = {
  scanForSuccessIndicators,
  scanForErrorIndicators,
  checkClientValidation,
  assertFormRejected,
  assertFormAccepted,
  assertVisible,
  assertHidden,
  assertTextContains,
  resolveLocator,
};
