import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Same servers as the e2e suite, but runs the benchmark in ./bench. */
export default defineConfig({
  ...base,
  testDir: "./bench",
  retries: 0,
  reporter: "list",
  timeout: 120_000,
});
