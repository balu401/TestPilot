const { test, expect } = require("@playwright/test");

test("Successful registration with matching passwords and all required fields", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173");
  await page.getByTestId("name").fill("Test User");
  await page.getByTestId("email").fill("testuser@example.com");
  await page.getByTestId("password").fill("SecurePass123!");
  await page.getByTestId("confirm-password").fill("SecurePass123!");
  await page.getByTestId("terms").check();
  await page.getByTestId("create-account").click();
  await expect(page.getByTestId("registration-success")).toBeVisible();
});
