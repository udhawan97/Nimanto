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
    metadata: { component: { purl: "pkg:npm/nimanto@0.5.5" } },
    components: [{ purl: "pkg:npm/example@1.0.0" }, { purl: "pkg:npm/example@1.0.0" }],
  };
  const spdx = {
    "@graph": [
      { software_packageUrl: "pkg:npm/example@1.0.0" },
      { software_packageUrl: "pkg:npm/nimanto@0.5.5" },
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
    metadata: {
      timestamp: "2026-08-21T12:00:00Z",
      component: {
        properties: [
          { name: "cdx:npm:lastModifiedTime", value: "2026-08-01T12:00:00Z" },
          { name: "cdx:npm:versionCount", value: "32" },
          { name: "cdx:npm:artifactIntegrity", value: "sha512-a" },
        ],
      },
    },
    annotations: [{ timestamp: "2026-08-21T12:00:00Z" }],
  };
  const secondCycloneDx = structuredClone(firstCycloneDx);
  secondCycloneDx.serialNumber = "urn:uuid:second";
  secondCycloneDx.metadata.timestamp = "2026-08-21T12:01:00Z";
  secondCycloneDx.annotations[0].timestamp = "2026-08-21T12:01:00Z";
  secondCycloneDx.metadata.component.properties[0].value = "2026-08-23T01:42:52Z";
  secondCycloneDx.metadata.component.properties[1].value = "35";
  assert.deepEqual(stableCycloneDx(firstCycloneDx), stableCycloneDx(secondCycloneDx));
  secondCycloneDx.metadata.component.properties[2].value = "sha512-b";
  assert.notDeepEqual(stableCycloneDx(firstCycloneDx), stableCycloneDx(secondCycloneDx));

  const firstSpdx = {
    "@graph": [
      {
        "@id": "urn:cdxgen:spdx:11111111-1111-1111-1111-111111111111#root",
        created: "2026-08-21T12:00:00Z",
        extension: [
          {
            extension_cdxPropName: "properties.cdx:npm:lastModifiedTime",
            extension_cdxPropValue: "2026-08-01T12:00:00Z",
          },
          {
            extension_cdxPropName: "properties.cdx:npm:versionCount",
            extension_cdxPropValue: "32",
          },
          {
            extension_cdxPropName: "properties.cdx:npm:artifactIntegrity",
            extension_cdxPropValue: "sha512-a",
          },
        ],
      },
    ],
  };
  const secondSpdx = structuredClone(firstSpdx);
  secondSpdx["@graph"][0]["@id"] = "urn:cdxgen:spdx:22222222-2222-2222-2222-222222222222#root";
  secondSpdx["@graph"][0].created = "2026-08-21T12:01:00Z";
  secondSpdx["@graph"][0].extension[0].extension_cdxPropValue = "2026-08-23T01:42:52Z";
  secondSpdx["@graph"][0].extension[1].extension_cdxPropValue = "35";
  assert.deepEqual(stableSpdx(firstSpdx), stableSpdx(secondSpdx));
  secondSpdx["@graph"][0].extension[2].extension_cdxPropValue = "sha512-b";
  assert.notDeepEqual(stableSpdx(firstSpdx), stableSpdx(secondSpdx));
});

test("source occurrence churn does not make an immutable release inventory stale", () => {
  const firstCycloneDx = {
    components: [
      {
        purl: "pkg:npm/example@1.0.0",
        evidence: { occurrences: [{ location: "src/server.ts", line: 42 }] },
      },
    ],
  };
  const secondCycloneDx = structuredClone(firstCycloneDx);
  secondCycloneDx.components[0].evidence.occurrences = [
    { location: "src/renamed-server.ts", line: 84 },
  ];
  assert.deepEqual(stableCycloneDx(firstCycloneDx), stableCycloneDx(secondCycloneDx));

  const firstSpdx = {
    "@graph": [
      {
        software_packageUrl: "pkg:npm/example@1.0.0",
        extension: [
          {
            extension_cdxPropValue: JSON.stringify({
              identity: [{ field: "purl", confidence: 1 }],
              occurrences: [{ location: "src/server.ts", line: 42 }],
            }),
          },
        ],
      },
    ],
  };
  const secondSpdx = structuredClone(firstSpdx);
  secondSpdx["@graph"][0].extension[0].extension_cdxPropValue = JSON.stringify({
    identity: [{ field: "purl", confidence: 1 }],
    occurrences: [{ location: "src/renamed-server.ts", line: 84 }],
  });
  assert.deepEqual(stableSpdx(firstSpdx), stableSpdx(secondSpdx));
});
