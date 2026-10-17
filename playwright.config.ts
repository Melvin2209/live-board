import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = 3100;
const WS_PORT = 1300;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `npm run start:server`,
      port: WS_PORT,
      env: { PORT: String(WS_PORT), DB_PATH: "data/e2e.sqlite" },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      port: WEB_PORT,
      env: { NEXT_PUBLIC_WS_URL: `ws://localhost:${WS_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
