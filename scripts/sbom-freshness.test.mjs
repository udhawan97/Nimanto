import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePurlSets,
  cyclonedxPurls,
  stableCycloneDx,
  stableSpdx,
  spdxPurls,
} from "./verify-sbom-freshness.mjs";

test("CycloneDX and SPDX package identities normalize to one comparable set", () => {
  const cyclonedx = {
    metadata: { component: { purl: "pkg:npm/nimanto@0.5.2" } },
    components: [{ purl: "pkg:npm/example@1.0.0" }, { purl: "pkg:npm/example@1.0.0" }],
  };
  const spdx = {
    "@graph": [
      { software_packageUrl: "pkg:npm/example@1.0.0" },
      { software_packageUrl: "pkg:npm/nimanto@0.5.2" },
    ],
  };
  assert.deepEqual(cyclonedxPurls(cyclonedx), spdxPurls(spdx));
});

test("freshness comparison rejects missing or stale dependency identities", () => {
  assert.throws(
    () => comparePurlSets("inventory", ["pkg:npm/pglite@0.5.5"], ["pkg:npm/pglite@0.0.0"]),
    /missing: pkg:npm\/pglite@0\.5\.5; unexpected: pkg:npm\/pglite@0\.0\.0/,
  );
});

test("volatile inventory identity is ignored without hiding release metadata drift", () => {
  const firstCycloneDx = {
    serialNumber: "urn:uuid:first",
    metadata: { timestamp: "2026-08-21T12:00:00Z", component: { properties: ["scripts:a"] } },
    annotations: [{ timestamp: "2026-08-21T12:00:00Z" }],
  };
  const secondCycloneDx = structuredClone(firstCycloneDx);
  secondCycloneDx.serialNumber = "urn:uuid:second";
  secondCycloneDx.metadata.timestamp = "2026-08-21T12:01:00Z";
  secondCycloneDx.annotations[0].timestamp = "2026-08-21T12:01:00Z";
  assert.deepEqual(stableCycloneDx(firstCycloneDx), stableCycloneDx(secondCycloneDx));
  secondCycloneDx.metadata.component.properties = ["scripts:b"];
  assert.notDeepEqual(stableCycloneDx(firstCycloneDx), stableCycloneDx(secondCycloneDx));

  assert.deepEqual(
    stableSpdx({
      "@graph": [
        {
          "@id": "urn:cdxgen:spdx:11111111-1111-1111-1111-111111111111#root",
          created: "2026-08-21T12:00:00Z",
        },
      ],
    }),
    stableSpdx({
      "@graph": [
        {
          "@id": "urn:cdxgen:spdx:22222222-2222-2222-2222-222222222222#root",
          created: "2026-08-21T12:01:00Z",
        },
      ],
    }),
  );
});
