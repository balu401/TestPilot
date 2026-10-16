/**
 * Discovery engine — crawls the target application and builds a structured
 * site map of pages, forms, interactive elements, and status indicators.
 *
 * The discovery is heuristic-based (no LLM required). It runs Playwright's
 * page.evaluate to inspect the live DOM and classify elements by their
 * attributes, roles, and naming patterns.
 */

const INDICATOR_SUCCESS_PATTERN = /success|confirm|welcome|complete|thank/i;
const INDICATOR_ERROR_PATTERN = /error|invalid|fail|alert|warning|danger/i;
const INDICATOR_INFO_PATTERN = /info|notice|message|status|feedback/i;

/**
 * Extract structured information about every interactive element on the
 * current page. Runs entirely inside the browser context via page.evaluate.
 */
async function extractPageInfo(page) {
  return page.evaluate(() => {
    /* ---- helpers (run in browser) ---- */

    function selectorFor(el) {
      const testId = el.getAttribute("data-testid");
      if (testId) return { strategy: "testid", value: testId };
      const id = el.getAttribute("id");
      if (id) return { strategy: "id", value: `#${id}` };
      const name = el.getAttribute("name");
      if (name) return { strategy: "name", value: name };
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute("type");
      if (type) return { strategy: "css", value: `${tag}[type="${type}"]` };
      const text = el.textContent?.trim().substring(0, 40);
      if (text && ["button", "a"].includes(tag)) return { strategy: "text", value: text };
      return { strategy: "css", value: tag };
    }

    function fallbacksFor(el) {
      const primary = selectorFor(el);
      const fallbacks = [];
      const testId = el.getAttribute("data-testid");
      const id = el.getAttribute("id");
      const name = el.getAttribute("name");
      if (testId && primary.strategy !== "testid") fallbacks.push({ strategy: "testid", value: testId });
      if (id && primary.strategy !== "id") fallbacks.push({ strategy: "id", value: `#${id}` });
      if (name && primary.strategy !== "name") fallbacks.push({ strategy: "name", value: name });
      return fallbacks;
    }

    function extractEl(el) {
      const labelEl = (() => {
        const id = el.getAttribute("id");
        if (id) { const l = document.querySelector(`label[for="${id}"]`); if (l) return l; }
        const p = el.closest("label");
        if (p) return p;
        return null;
      })();
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || undefined,
        testId: el.getAttribute("data-testid") || undefined,
        id: el.getAttribute("id") || undefined,
        name: el.getAttribute("name") || undefined,
        label: labelEl ? labelEl.textContent.trim() : undefined,
        placeholder: el.getAttribute("placeholder") || undefined,
        required: el.hasAttribute("required") || undefined,
        text: el.textContent?.trim().substring(0, 100) || undefined,
        visible: el.offsetParent !== null || el.getClientRects().length > 0,
        selector: selectorFor(el),
        fallbacks: fallbacksFor(el),
      };
    }

    /* ---- forms ---- */
    const forms = Array.from(document.querySelectorAll("form")).map((form) => ({
      action: form.getAttribute("action") || undefined,
      method: (form.getAttribute("method") || "get").toLowerCase(),
      testId: form.getAttribute("data-testid") || undefined,
      selector: selectorFor(form),
      fields: Array.from(form.querySelectorAll("input, textarea, select"))
        .filter((el) => !["hidden", "submit"].includes(el.type))
        .map(extractEl),
      submitButtons: Array.from(
        form.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]')
      ).map(extractEl),
    }));

    /* ---- links (same-origin, visible) ---- */
    const links = Array.from(document.querySelectorAll("a[href]"))
      .filter((a) => {
        try {
          const u = new URL(a.href, location.origin);
          return u.origin === location.origin && (a.offsetParent !== null || a.getClientRects().length > 0);
        } catch { return false; }
      })
      .map((a) => ({
        href: a.getAttribute("href"),
        text: a.textContent.trim().substring(0, 100),
        selector: selectorFor(a),
      }))
      // deduplicate by href
      .filter((link, i, arr) => arr.findIndex((l) => l.href === link.href) === i);

    /* ---- standalone buttons (outside forms) ---- */
    const buttons = Array.from(document.querySelectorAll("button"))
      .filter((btn) => !btn.closest("form") && (btn.offsetParent !== null || btn.getClientRects().length > 0))
      .map(extractEl);

    /* ---- headings ---- */
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => ({
      level: parseInt(h.tagName[1], 10),
      text: h.textContent.trim().substring(0, 200),
    }));

    /* ---- indicators (success / error / info feedback elements) ---- */
    const successRe = /success|confirm|welcome|complete|thank/i;
    const errorRe = /error|invalid|fail|alert|warning|danger/i;
    const infoRe = /info|notice|message|status|feedback/i;

    const indicatorCandidates = Array.from(
      document.querySelectorAll("[data-testid], [role='alert'], .alert, .error, .success, .message")
    );
    const indicators = [];
    const seen = new Set();
    for (const el of indicatorCandidates) {
      const sig = el.outerHTML.substring(0, 120);
      if (seen.has(sig)) continue;
      seen.add(sig);
      const testId = el.getAttribute("data-testid") || "";
      const cls = el.className || "";
      const combined = testId + " " + cls;
      let type = null;
      if (successRe.test(combined)) type = "success";
      else if (errorRe.test(combined)) type = "error";
      else if (infoRe.test(combined)) type = "info";
      else if (el.getAttribute("role") === "alert") type = "error";
      if (!type) continue;
      indicators.push({
        type,
        testId: testId || undefined,
        className: cls || undefined,
        selector: selectorFor(el),
        text: el.textContent?.trim().substring(0, 200) || undefined,
        visible: (el.offsetParent !== null || el.getClientRects().length > 0) && (el.textContent?.trim().length > 0),
      });
    }

    return { url: location.href, title: document.title, forms, links, buttons, headings, indicators };
  });
}

/**
 * Crawl the target application starting from `baseUrl`. Visits same-origin
 * pages up to `maxDepth` link-hops and `maxPages` total pages.
 *
 * Returns a siteMap object describing every discovered page.
 */
async function discoverSite(page, baseUrl, options = {}) {
  const maxDepth = options.maxDepth ?? 2;
  const maxPages = options.maxPages ?? 10;
  const visited = new Set();
  const pages = [];

  async function visit(url, depth) {
    if (depth > maxDepth || visited.size >= maxPages) return;
    const normalized = url.replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/$/, "");
    if (visited.has(normalized)) return;
    visited.add(normalized);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      // Allow dynamic content to render
      await page.waitForTimeout(500);
      const info = await extractPageInfo(page);
      pages.push(info);

      // Follow same-origin links one level deeper
      if (depth < maxDepth) {
        const childHrefs = info.links
          .map((l) => { try { return new URL(l.href, url).toString(); } catch { return null; } })
          .filter(Boolean);
        for (const href of childHrefs) {
          if (pages.length >= maxPages) break;
          await visit(href, depth + 1);
        }
      }
    } catch (err) {
      console.warn(`Discovery: could not load ${url}: ${err.message}`);
    }
  }

  await visit(baseUrl, 0);

  return { baseUrl, pages, discoveredAt: new Date().toISOString() };
}

module.exports = { discoverSite, extractPageInfo };
