import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // happy-dom is here for future component tests. The current suite is pure
    // logic and token arithmetic; note that NO DOM environment performs layout,
    // which is why the spacing contract is verified in Playwright, not here.
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
  },
});
