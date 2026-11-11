import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The date logic runs in the device's local timezone. Pin one with daylight
// saving (US Eastern: clocks change on 2026-03-08 and 2026-11-01) so the tests
// cover 23- and 25-hour days, whatever machine runs them. Workers inherit this.
process.env.TZ = "America/New_York";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
