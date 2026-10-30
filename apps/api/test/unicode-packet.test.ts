import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalHash } from "@nimanto/domain";
import { buildServer } from "../src/server.js";

const apps: FastifyInstance[] = [];
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(candidateName: string, claimText: string) {
  const root = await mkdtemp(path.join(tmpdir(), "nimanto-unicode-api-"));
  roots.push(root);
  const bootstrapSecret = "synthetic-unicode-bootstrap-secret-at-least-32-characters";
  const app = await buildServer({
    dataDirectory: path.join(root, "database"),
    artifactDirectory: path.join(root, "artifacts"),
    outboxDirectory: path.join(root, "outbox"),
    webOrigin: "http://127.0.0.1:4300",
    demoMode: true,
    externalActionsEnabled: false,
    bootstrapSecret,
    urlAllowlist: [],
    port: 4310,
    host: "127.0.0.1",
  });
  apps.push(app);
  await app.ready();
  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/local",
    headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
    payload: { displayName: candidateName, email: "unicode@example.test" },
  });
  expect(login.statusCode).toBe(200);
  const header = login.headers["set-cookie"];
  const cookie = (Array.isArray(header) ? header[0] : header)?.split(";")[0] ?? "";
  const request = async (url: string, payload?: Record<string, unknown>) => {
    const response = await app.inject({
      method: "POST",
      url,
      headers: { cookie },
      ...(payload ? { payload } : {}),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json();
  };
  const claim = await request("/v1/evidence", {
    kind: "accomplishment",
    value: claimText,
    sourceName: "Synthetic Unicode fixture",
    locator: "line:1",
  });
  await request(`/v1/evidence/${claim.id}/confirm`);
  await request("/v1/profile/versions", { authorizationWording: "Authorized to work." });
  const job = await request("/v1/jobs", {
    title: "Platform Engineer",
    company: "Synthetic Works",
    description: "Build reliable systems",
    requirements: [],
  });
  await request(`/v1/jobs/${job.id}/match`);
  const application = await request("/v1/applications", { jobId: job.id });
  return {
    app,
    root,
    cookie,
    request,
    application,
    claim,
    tenantId: login.json().identity.tenantId,
  };
}

describe("Unicode packets through the API", () => {
  it.each([
    ["张伟", "设计可靠的数据平台。"],
    ["अनन्या शर्मा", "अनुभव: विश्वसनीय प्रणालियों का निर्माण।"],
    ["Zoë García — 张伟", "Résumé: café, naïve; अनुभव और TypeScript."],
  ])("generates, verifies and assures six faithful formats for %s", async (name, claimText) => {
    const { app, root, cookie, request, application, claim, tenantId } = await fixture(
      name,
      claimText,
    );
    const payload = { applicationId: application.id, evidenceIds: [claim.id] };
    const packet = await request("/v1/packets", payload);
    expect(packet.canonicalContent).toMatchObject({
      schemaVersion: "packet_v2",
      candidateName: name,
      claims: [{ text: claimText, evidenceIds: [claim.id] }],
    });
    expect(packet.artifactHash).toBe(canonicalHash(packet.canonicalContent));
    expect(packet.artifactManifest.documentInspection.status).toBe("passed");
    const artifacts = packet.artifactManifest.artifacts as Array<{
      format: string;
      filename: string;
      sha256: string;
    }>;
    expect(artifacts.map((artifact) => artifact.format)).toEqual([
      "json",
      "txt",
      "modern_docx",
      "modern_pdf",
      "ats_docx",
      "ats_pdf",
    ]);
    for (const artifact of artifacts) {
      const downloaded = await app.inject({
        method: "GET",
        url: `/v1/packets/${packet.id}/artifacts/${artifact.format}`,
        headers: { cookie },
      });
      expect(downloaded.statusCode).toBe(200);
      expect(createHash("sha256").update(downloaded.rawPayload).digest("hex")).toBe(
        artifact.sha256,
      );
    }
    const repeated = await request("/v1/packets", payload);
    expect(repeated.canonicalContent).toEqual(packet.canonicalContent);
    expect(repeated.artifactHash).toBe(packet.artifactHash);
    expect(await request(`/v1/packets/${repeated.id}/assure`)).toMatchObject({ status: "passed" });
    expect(await readdir(path.join(root, "artifacts", tenantId, ".staging"))).toEqual([]);

    const textArtifact = repeated.artifactManifest.artifacts.find(
      (artifact: { format: string }) => artifact.format === "txt",
    );
    const content = await readFile(
      path.join(root, "artifacts", tenantId, repeated.id, textArtifact.filename),
      "utf8",
    );
    expect(content).toContain(name);
    expect(content).toContain(claimText);
  });

  it("explains unsupported packet text while preserving evidence and application state", async () => {
    const { app, root, cookie, application, claim, tenantId } = await fixture(
      "Synthetic 🦄",
      "A confirmed synthetic accomplishment.",
    );
    const refused = await app.inject({
      method: "POST",
      url: "/v1/packets",
      headers: { cookie },
      payload: { applicationId: application.id, evidenceIds: [claim.id] },
    });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.code).toBe("PACKET_TEXT_UNSUPPORTED");
    const dashboard = (
      await app.inject({ method: "GET", url: "/v1/dashboard", headers: { cookie } })
    ).json();
    expect(dashboard.packets).toEqual([]);
    expect(dashboard.applications[0].status).toBe(application.status);
    expect(dashboard.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: claim.id, value: claim.value, status: "confirmed" }),
      ]),
    );
    expect(await readdir(path.join(root, "artifacts", tenantId))).toEqual([".staging"]);
    expect(await readdir(path.join(root, "artifacts", tenantId, ".staging"))).toEqual([]);
  });
});
