import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic", importSource: "react" },
  },
  test: {
    // happy-dom covers component behavior but performs no layout, which is why
    // the spacing contract is verified in Playwright rather than here.
    environment: "happy-dom",
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
