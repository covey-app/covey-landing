import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the Covey landing page. Builds the site and serves the
 * production output via `astro preview`, then runs overflow, accessibility
 * (axe), and smoke checks across Chromium, Firefox, WebKit, and mobile
 * viewports. Set PW_BROWSER to scope to a single project locally.
 */
const PORT = 4321;
const only = process.env.PW_BROWSER;

const allProjects = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
  { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
];

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: only ? allProjects.filter((p) => p.name === only) : allProjects,
  webServer: {
    command: "npm run build && npm run preview",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
