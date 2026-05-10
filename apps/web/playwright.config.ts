import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for GharSetu Phase 1 E2E tests.
 * Runs against apps/api (localhost:3001) + apps/web (localhost:3000).
 * Both servers must be running before the suite executes.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-results.json" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
