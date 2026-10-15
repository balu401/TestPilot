const { test, expect } = require("@playwright/test");

test("customer can add a notebook and reach checkout", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173");
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
