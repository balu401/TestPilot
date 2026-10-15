const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");
const { createPlan } = require("./plan");

function now() {
  return new Date().toISOString();
}

function parseMoney(text) {
  const match = text.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
  if (!match) throw new Error(`Could not parse money from "${text}"`);
  return Number(match[1]);
}

function money(value) {
  return `$${value.toFixed(2)}`;
}

async function ensureArtifacts(artifactRoot) {
  await fs.rm(artifactRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(artifactRoot, "screenshots"), { recursive: true });
  await fs.mkdir(path.join(artifactRoot, "generated"), { recursive: true });
}

async function run(options = {}) {
  const baseUrl = options.appUrl || process.env.APP_URL || "http://127.0.0.1:4173";
  const artifactRoot = path.resolve(options.artifactDir || process.env.ARTIFACT_DIR || "artifacts/latest");
  await ensureArtifacts(artifactRoot);
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const description = options.description || "BugShop lets a customer add a product, see an accurate total, and complete checkout.";
  const plan = createPlan(baseUrl, description);
  await fs.writeFile(path.join(artifactRoot, "plan.json"), JSON.stringify(plan, null, 2));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const steps = [];
  const bugs = [];
  const startedAt = now();

  async function step(action, target, result, screenshotName) {
    const screenshot = `screenshots/${screenshotName}.png`;
    await page.screenshot({ path: path.join(artifactRoot, screenshot), fullPage: true });
    steps.push({ at: now(), action, target, result, screenshot });
  }

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await step("Open the product catalogue", "/", "pass: catalogue loaded", "01-catalogue");

    await page.getByTestId("add-notebook").click();
    await page.getByTestId("added-notice").waitFor();
    await step("Add the QA Notebook to the cart", '[data-testid="add-notebook"]', "pass: add confirmation visible", "02-added");

    await page.getByTestId("cart-link").click();
    await page.getByTestId("cart-total").waitFor();
    const lineText = await page.getByTestId("line-price").innerText();
    const totalText = await page.getByTestId("cart-total").innerText();
    const expectedTotal = parseMoney(lineText);
    const actualTotal = parseMoney(totalText);
    await step("Open the cart", '[data-testid="cart-link"]', `observed line ${lineText}; observed total ${totalText}`, "03-cart");

    if (actualTotal !== expectedTotal) {
      const evidence = {
        runId,
        title: "Cart total does not equal the product price",
        classification: "confirmed bug",
        severity: "high",
        confidence: 0.99,
        reproduction: [
          "Open the BugShop catalogue.",
          "Click Add to cart for QA Notebook.",
          "Open Cart.",
          "Compare the line-item price with the displayed total."
        ],
        expected: `The total should equal ${lineText} for one item.`,
        actual: `The total is ${totalText}, which is ${money(actualTotal - expectedTotal)} higher than the line item.`,
        assertion: `actualTotal (${actualTotal}) === expectedTotal (${expectedTotal})`,
        evidence: ["screenshots/03-cart.png"],
        detectedAt: now()
      };
      bugs.push(evidence);
      steps.push({ at: now(), action: "Verify cart total", target: '[data-testid="cart-total"]', result: `fail: ${evidence.actual}`, screenshot: "screenshots/03-cart.png" });
    } else {
      await step("Verify cart total", '[data-testid="cart-total"]', "pass: total equals line price", "04-total");
    }

    await page.getByTestId("checkout-link").click();
    await page.getByTestId("email").fill("demo@example.com");
    await page.getByTestId("address").fill("42 QA Lane");
    await page.getByTestId("place-order").click();
    await page.getByTestId("order-success").waitFor();
    await step("Complete checkout with valid details", '[data-testid="place-order"]', "pass: order confirmation visible", "05-checkout");
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const result = {
    runId,
    startedAt,
    completedAt: now(),
    appUrl: baseUrl,
    plan,
    summary: {
      tests: plan.testCases.length,
      passedJourneys: 1,
      confirmedBugs: bugs.length,
      status: bugs.length ? "completed_with_findings" : "completed"
    },
    steps,
    bugs
  };
  await fs.writeFile(path.join(artifactRoot, "result.json"), JSON.stringify(result, null, 2));
  const generated = generatedTest(baseUrl);
  await fs.writeFile(path.join(artifactRoot, "generated", "cart-journey.spec.js"), generated);
  if (!options.artifactDir) {
    await fs.mkdir(path.resolve("generated"), { recursive: true });
    await fs.writeFile(path.resolve("generated/cart-journey.spec.js"), generated);
  }
  console.log(JSON.stringify(result.summary));
  return result;
}

function generatedTest(url) {
  return `const { test, expect } = require("@playwright/test");

test("customer can add a notebook and reach checkout", async ({ page }) => {
  await page.goto(${JSON.stringify(url)});
  await page.getByTestId("add-notebook").click();
  await expect(page.getByTestId("added-notice")).toBeVisible();
  await page.getByTestId("cart-link").click();
  await expect(page.getByTestId("cart-line")).toContainText("QA Notebook");
  await page.getByTestId("checkout-link").click();
  await page.getByTestId("email").fill("generated@example.com");
  await page.getByTestId("address").fill("42 Generated Lane");
  await page.getByTestId("place-order").click();
  await expect(page.getByTestId("order-success")).toBeVisible();
});
`;
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { run };
