import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Exercise the development JSX runtime too: preview only tests built bundles.
export default defineConfig({
  ...base,
  grep: /live locale switch preserves a paused calculation/,
  webServer: {
    command: "npm run dev -- --port 4176",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
  },
  use: { ...base.use, baseURL: "http://127.0.0.1:4176" },
});
