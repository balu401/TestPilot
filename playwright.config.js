const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./generated",
  webServer: {
    command: "node sample-app/server.js",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 15_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  // Match any .spec.js file in generated/ (not just cart-journey)
  testMatch: "**/*.spec.js",
});
