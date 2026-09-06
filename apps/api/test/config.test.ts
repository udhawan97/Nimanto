import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadOptions } from "../src/config.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function environment(overrides: NodeJS.ProcessEnv = {}): Promise<NodeJS.ProcessEnv> {
  const root = await mkdtemp(path.join(tmpdir(), "nimanto-config-"));
  roots.push(root);
  return {
    NIMANTO_DATA_DIR: root,
    NIMANTO_BOOTSTRAP_SECRET: "configuration-test-secret-with-at-least-32-characters",
    ...overrides,
  };
}

describe("API configuration", () => {
  it("accepts only the documented on/off boolean vocabulary", async () => {
    expect(loadOptions(await environment({ NIMANTO_DEMO_MODE: "off" })).demoMode).toBe(false);
    expect(
      loadOptions(await environment({ NIMANTO_EXTERNAL_ACTIONS_ENABLED: "on" }))
        .externalActionsEnabled,
    ).toBe(true);
    expect(() => loadOptions({ NIMANTO_DEMO_MODE: "false" })).toThrow(/NIMANTO_DEMO_MODE/u);
  });

  it("records whether the launch secret was generated, so the banner never echoes a supplied one", async () => {
    const supplied = loadOptions(await environment());
    expect(supplied.bootstrapSecretGenerated).toBe(false);

    const withoutSecret = await environment();
    delete withoutSecret.NIMANTO_BOOTSTRAP_SECRET;
    const generated = loadOptions(withoutSecret);
    expect(generated.bootstrapSecretGenerated).toBe(true);
    expect(generated.bootstrapSecret.length).toBeGreaterThanOrEqual(32);
  });

  it("keeps fail-closed defaults and refuses demo mode on a public bind", async () => {
    const defaults = loadOptions(await environment());
    expect(defaults).toMatchObject({
      host: "127.0.0.1",
      port: 4310,
      webOrigin: "http://127.0.0.1:4300",
      demoMode: true,
      externalActionsEnabled: false,
    });
    const publicDemo = await environment({
      NIMANTO_API_HOST: "0.0.0.0",
      NIMANTO_DEMO_MODE: "on",
    });
    expect(() => loadOptions(publicDemo)).toThrow(/loopback host/u);
  });

  it("rejects partial, out-of-range, and non-calendar configuration values", async () => {
    const partialPort = await environment({ NIMANTO_API_PORT: "4310junk" });
    const outOfRangePort = await environment({ NIMANTO_API_PORT: "65536" });
    const invalidDate = await environment({
      NIMANTO_URL_ALLOWLIST: "example.test",
      NIMANTO_URL_TERMS_REVIEWED_AT: "2026-02-30",
    });
    const invalidOrigin = await environment({
      NIMANTO_WEB_ORIGIN: "https://user:secret@example.test/path?query=yes#fragment",
    });
    expect(() => loadOptions(partialPort)).toThrow(/integer port/u);
    expect(() => loadOptions(outOfRangePort)).toThrow(/between 1 and 65535/u);
    expect(() => loadOptions(invalidDate)).toThrow(/ISO calendar date/u);
    expect(() => loadOptions(invalidOrigin)).toThrow(/credential-free HTTP or HTTPS origin/u);
    expect(
      loadOptions(await environment({ NIMANTO_WEB_ORIGIN: "https://example.test:8443/" }))
        .webOrigin,
    ).toBe("https://example.test:8443");
  });
});
