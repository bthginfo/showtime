import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /showtime.*\.spec\.ts/,
  timeout: 120000,
  use: { baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3100", trace: "retain-on-failure", viewport:{width:1440,height:1000} },
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
});
