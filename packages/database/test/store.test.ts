import { chmod, mkdir, mkdtemp, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createReceipt, matchJob } from "@nimanto/domain";
import { NimantoStore } from "../src/store.js";

const stores: NimantoStore[] = [];

async function expectPrivateTree(directory: string): Promise<void> {
  expect((await stat(directory)).mode & 0o777).toBe(0o700);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) await expectPrivateTree(target);
    else if (entry.isFile()) expect((await stat(target)).mode & 0o777).toBe(0o600);
  }
}

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

describe("tenant-scoped persistence public seam", () => {
  it("creates private database paths and tightens an existing permissive directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-permissions-"));
    const data = join(root, "data");
    await mkdir(data, { mode: 0o755 });
    await chmod(data, 0o755);
    const store = await NimantoStore.open(data);
    stores.push(store);
    await expectPrivateTree(data);
  });

  it("never returns another tenant's evidence even when a foreign ID is supplied", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);

    const alpha = await store.createLocalTenant("alpha@example.test", "Alpha");
    const beta = await store.createLocalTenant("beta@example.test", "Beta");
    const claim = await store.createEvidence(alpha.tenantId, {
      kind: "skill",
      value: "TypeScript",
      sourceName: "Synthetic resume",
      locator: "Skills, line 1",
      confidence: "high",
      status: "confirmed",
    });

    expect(await store.getEvidence(alpha.tenantId, claim.id)).toMatchObject({
      value: "TypeScript",
    });
    expect(await store.getEvidence(beta.tenantId, claim.id)).toBeNull();
    expect(await store.listEvidence(beta.tenantId)).toEqual([]);
  });

  it("revokes a local session and never stores its raw token", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);

    const identity = await store.createLocalTenant("session@example.test", "Session");
    const session = await store.createSession(identity.userId, identity.tenantId);
    expect(await store.resolveSession(session.token)).toMatchObject({
      tenantId: identity.tenantId,
    });
    expect(await store.databaseContains(session.token)).toBe(false);

    await store.revokeSession(session.token);
    expect(await store.resolveSession(session.token)).toBeNull();
  });

  it("accepts only a matching single-use, unexpired, unrevoked invitation", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);

    const invite = await store.issueInvitation("invited@example.test");
    await expect(
      store.acceptInvitation(invite.token, "substitute@example.test", "Substitute"),
    ).rejects.toThrow("INVITATION_EMAIL_MISMATCH");
    const identity = await store.acceptInvitation(
      invite.token,
      "invited@example.test",
      "Invited Candidate",
    );
    expect(identity).toMatchObject({ email: "invited@example.test" });
    await expect(
      store.acceptInvitation(invite.token, "invited@example.test", "Again"),
    ).rejects.toThrow("INVITATION_USED");

    const expired = await store.issueInvitation("expired@example.test", -1);
    await expect(
      store.acceptInvitation(expired.token, "expired@example.test", "Expired"),
    ).rejects.toThrow("INVITATION_EXPIRED");

    const revoked = await store.issueInvitation("revoked@example.test");
    expect(await store.revokeInvitation(revoked.id)).toBe(true);
    await expect(
      store.acceptInvitation(revoked.token, "revoked@example.test", "Revoked"),
    ).rejects.toThrow("INVITATION_REVOKED");
  });

  it("revokes tenant access as soon as resumable deletion begins", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);

    const identity = await store.createLocalTenant("delete@example.test", "Delete");
    const session = await store.createSession(identity.userId, identity.tenantId);
    expect(await store.resolveSession(session.token)).not.toBeNull();

    await store.beginTenantDeletion(identity.tenantId, []);
    expect(await store.resolveSession(session.token)).toBeNull();
  });
});

describe("beta workflow persistence", () => {
  it("rejects a schedule that its provider adapter could never execute", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("invalid-board@example.test", "Owner");

    await expect(
      store.createSourceSchedule(owner.tenantId, {
        provider: "greenhouse",
        board: "not.valid.for-provider",
        cadenceMinutes: 60,
      }),
    ).rejects.toThrow("INVALID_BOARD");
  });

  it("deduplicates concurrent creation of the same active source schedule", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("duplicate-schedule@example.test", "Owner");
    const input = {
      provider: "greenhouse" as const,
      board: "northwind",
      cadenceMinutes: 60,
    };

    const [first, second] = await Promise.all([
      store.createSourceSchedule(owner.tenantId, input),
      store.createSourceSchedule(owner.tenantId, input),
    ]);
    expect(second.id).toBe(first.id);
    expect(await store.listSourceSchedules(owner.tenantId)).toHaveLength(1);
  });

  it("leases each tenant schedule once and returns it to its recurring cadence", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const data = join(root, "data");
    const store = await NimantoStore.open(data);
    stores.push(store);
    const alpha = await store.createLocalTenant("alpha-schedule@example.test", "Alpha");
    const beta = await store.createLocalTenant("beta-schedule@example.test", "Beta");

    const scheduled = await store.createSourceSchedule(alpha.tenantId, {
      provider: "greenhouse",
      board: "northwind",
      cadenceMinutes: 60,
      notBefore: "2020-01-01T00:00:00.000Z",
    });
    expect(await store.listSourceSchedules(alpha.tenantId)).toEqual([scheduled]);
    expect(await store.listSourceSchedules(beta.tenantId)).toEqual([]);
    expect(await store.pauseSourceSchedule(beta.tenantId, scheduled.id)).toBeNull();

    const claimed = await store.claimDueSourceSchedule();
    expect(claimed).toMatchObject({
      schedule: { id: scheduled.id, tenantId: alpha.tenantId, state: "running", attempts: 1 },
    });
    expect(claimed?.leaseToken).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
    expect(await store.claimDueSourceSchedule()).toBeNull();

    const completed = await store.completeSourceSchedule(
      scheduled.id,
      claimed!.leaseToken,
      { imported: 12, matched: 12 },
      "2026-08-05T12:00:00.000Z",
    );
    expect(completed).toMatchObject({
      state: "queued",
      attempts: 0,
      lastResult: { imported: 12, matched: 12 },
      lastRunAt: "2026-08-05T12:00:00.000Z",
      notBefore: "2026-08-05T13:00:00.000Z",
    });
    await store.close();
    stores.splice(stores.indexOf(store), 1);
    const reopened = await NimantoStore.open(data);
    stores.push(reopened);
    expect(await reopened.listSourceSchedules(alpha.tenantId)).toEqual([completed]);
    expect((await reopened.exportTenant(alpha.tenantId)).schedules).toEqual([completed]);
  });

  it("lets the owning tenant recover retries while cancellation remains terminal", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("schedule-owner@example.test", "Owner");
    const schedule = await store.createSourceSchedule(owner.tenantId, {
      provider: "lever",
      board: "northwind",
      cadenceMinutes: 120,
      notBefore: "2020-01-01T00:00:00.000Z",
    });

    expect(await store.pauseSourceSchedule(owner.tenantId, schedule.id)).toMatchObject({
      state: "paused",
    });
    expect(await store.claimDueSourceSchedule()).toBeNull();
    expect(await store.resumeSourceSchedule(owner.tenantId, schedule.id)).toMatchObject({
      state: "queued",
      attempts: 0,
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await store.runSourceScheduleNow(owner.tenantId, schedule.id);
      const claim = await store.claimDueSourceSchedule();
      expect(claim?.schedule.attempts).toBe(attempt);
      const failed = await store.failSourceSchedule(
        schedule.id,
        claim!.leaseToken,
        "PROVIDER_REFRESH_FAILED",
        "2026-08-05T12:00:00.000Z",
      );
      expect(failed.state).toBe(attempt === 5 ? "dead_letter" : "retry_wait");
    }

    expect(await store.resumeSourceSchedule(owner.tenantId, schedule.id)).toMatchObject({
      state: "queued",
      attempts: 0,
      lastErrorCode: null,
    });
    expect(await store.cancelSourceSchedule(owner.tenantId, schedule.id)).toMatchObject({
      state: "cancelled",
    });
    expect(await store.resumeSourceSchedule(owner.tenantId, schedule.id)).toBeNull();
    expect(await store.claimDueSourceSchedule()).toBeNull();
  });

  it("recovers an expired lease without allowing a duplicate active claim", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("lease-owner@example.test", "Lease owner");
    await store.createSourceSchedule(owner.tenantId, {
      provider: "ashby",
      board: "northwind",
      cadenceMinutes: 60,
      notBefore: "2026-08-05T09:00:00.000Z",
    });

    const first = await store.claimDueSourceSchedule(30, "2026-08-05T10:00:00.000Z");
    expect(first?.schedule.attempts).toBe(1);
    expect(await store.claimDueSourceSchedule(30, "2026-08-05T10:00:20.000Z")).toBeNull();
    await expect(
      store.completeSourceSchedule(
        first!.schedule.id,
        first!.leaseToken,
        { imported: 1, matched: 1 },
        "2026-08-05T10:00:31.000Z",
      ),
    ).rejects.toThrow("SCHEDULE_LEASE_INVALID");
    await expect(
      store.failSourceSchedule(
        first!.schedule.id,
        first!.leaseToken,
        "PROVIDER_REFRESH_FAILED",
        "2026-08-05T10:00:31.000Z",
      ),
    ).rejects.toThrow("SCHEDULE_LEASE_INVALID");
    const recovered = await store.claimDueSourceSchedule(30, "2026-08-05T10:00:31.000Z");
    expect(recovered?.schedule).toMatchObject({
      id: first?.schedule.id,
      state: "running",
      attempts: 2,
      lastErrorCode: "LEASE_EXPIRED",
    });
  });

  it("holds the lease row while scheduled writes commit so an expiry recovery cannot overlap", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const owner = await store.createLocalTenant("lease-lock@example.test", "Lease lock");
    const schedule = await store.createSourceSchedule(owner.tenantId, {
      provider: "greenhouse",
      board: "northwind",
      cadenceMinutes: 60,
      notBefore: "2026-08-05T09:00:00.000Z",
    });
    const claim = await store.claimDueSourceSchedule(30, "2026-08-05T10:00:00.000Z");
    let markWriteStarted: (() => void) | undefined;
    let releaseWrite: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    const writeReleased = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });

    const execution = store.executeSourceSchedule(
      schedule.id,
      claim!.leaseToken,
      async () => {
        markWriteStarted?.();
        await writeReleased;
        return { imported: 0, matched: 0 };
      },
      "2026-08-05T10:00:20.000Z",
    );
    await writeStarted;
    const overlappingClaim = store.claimDueSourceSchedule(30, "2026-08-05T10:00:31.000Z");
    releaseWrite?.();

    await expect(execution).resolves.toMatchObject({ schedule: { state: "queued" } });
    await expect(overlappingClaim).resolves.toBeNull();
  });

  it("rejects a receipt whose integrity hash does not match its canonical fields", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const data = join(root, "data");
    const store = await NimantoStore.open(data);
    stores.push(store);
    const identity = await store.createLocalTenant("receipt@example.test", "Receipt");
    const receipt = createReceipt({
      id: "receipt-1",
      type: "match.published",
      occurredAt: "2026-08-05T12:00:00.000Z",
      input: { jobId: "job-1" },
      artifact: { band: "mixed" },
    });

    await expect(
      store.saveReceipt(identity.tenantId, { ...receipt, receiptHash: "tampered" }, {}),
    ).rejects.toThrow("RECEIPT_INTEGRITY_INVALID");

    await store.saveReceipt(identity.tenantId, receipt, {});
    await store.close();
    stores.splice(stores.indexOf(store), 1);
    const raw = await PGlite.create(data);
    await raw.query("UPDATE receipts SET artifact_hash = 'tampered' WHERE id = $1", [receipt.id]);
    await raw.close();
    const reopened = await NimantoStore.open(data);
    stores.push(reopened);
    await expect(reopened.listReceipts(identity.tenantId)).rejects.toThrow(
      "RECEIPT_INTEGRITY_INVALID",
    );
  });

  it("stores jobs, deterministic matches, applications, and outcomes", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("priya@example.test", "Priya");
    const claim = await store.createEvidence(identity.tenantId, {
      kind: "skill",
      value: "TypeScript platform delivery",
      status: "confirmed",
      confidence: "high",
      sourceName: "manual",
      locator: "claim:1",
    });
    const profile = await store.createProfileVersion(
      identity.tenantId,
      "I would require H-1B transfer support.",
    );
    const job = await store.upsertJob(identity.tenantId, {
      source: "manual",
      sourceJobId: "job-1",
      title: "Platform Engineer",
      company: "Northwind",
      description: "Build TypeScript services",
      location: "Remote",
      workMode: "remote",
      url: "https://example.test/jobs/1",
      requirements: ["TypeScript"],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "content-1",
    });
    const result = matchJob({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      },
      evidence: [claim],
    });
    const match = await store.saveMatch(identity.tenantId, job.id, profile.id, result);
    const application = await store.createApplication(identity.tenantId, job.id, profile.id);
    const outcome = await store.addOutcome(identity.tenantId, application.id, {
      type: "screen",
      note: "Recruiter screen scheduled",
      occurredAt: "2026-08-05T12:00:00.000Z",
    });
    expect(match.result.requirements[0]?.evidenceIds).toEqual([claim.id]);
    expect(outcome.type).toBe("screen");
    expect((await store.listApplications(identity.tenantId))[0]?.outcomes).toHaveLength(1);
  });

  it("requires assurance before packet approval and records action transitions", async () => {
    const root = await mkdtemp(join(tmpdir(), "nimanto-store-"));
    const store = await NimantoStore.open(join(root, "data"));
    stores.push(store);
    const identity = await store.createLocalTenant("owner@example.test", "Owner");
    const job = await store.upsertJob(identity.tenantId, {
      source: "manual",
      sourceJobId: "job-2",
      title: "Engineer",
      company: "Northwind",
      description: "Build services",
      location: "",
      workMode: "unspecified",
      url: "",
      requirements: [],
      capability: "deep_link",
      sourceMeta: {},
      contentHash: "content-2",
    });
    const application = await store.createApplication(identity.tenantId, job.id, null);
    const packet = await store.createPacket(identity.tenantId, {
      applicationId: application.id,
      profileVersionId: null,
      canonicalContent: { claims: [] },
      artifactManifest: {},
    });
    await expect(store.approvePacket(identity.tenantId, packet.id)).rejects.toThrow(
      "ASSURANCE_REQUIRED",
    );
    await store.saveAssurance(identity.tenantId, packet.id, {
      status: "passed",
      ruleVersion: "application_assurance_v1",
      findings: [],
    });
    expect((await store.approvePacket(identity.tenantId, packet.id))?.status).toBe("approved");

    const action = await store.createExternalAction(identity.tenantId, {
      packetId: packet.id,
      provider: "test_outbox",
      target: { to: "jobs@example.test" },
      payload: { subject: "Application", body: "Hello" },
      idempotencyKey: "action-1",
    });
    expect(action.state).toBe("pending_approval");
    expect(
      (
        await store.transitionExternalAction(
          identity.tenantId,
          action.id,
          "pending_approval",
          "approved",
        )
      )?.state,
    ).toBe("approved");
  });
});
