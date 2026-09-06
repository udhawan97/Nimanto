import { access, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { NimantoStore } from "@nimanto/database";
import { renderPacketArtifacts } from "@nimanto/documents";
import { DeletionCoordinator } from "../src/deletion-coordinator.js";
import { publishMatch } from "../src/match-publication.js";
import { PacketLifecycle, type PacketArtifactRenderer } from "../src/packet-lifecycle.js";

const stores: NimantoStore[] = [];
const temporaryRoots: string[] = [];
async function mkdtempTracked(prefix: string): Promise<string> {
  const root = await mkdtemp(prefix);
  temporaryRoots.push(root);
  return root;
}
async function cleanTemporaryRoots(): Promise<void> {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
}

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await cleanTemporaryRoots();
});

async function packetFixture(label: string) {
  const root = await mkdtempTracked(join(tmpdir(), `nimanto-packet-${label}-`));
  const artifactDirectory = join(root, "artifacts");
  const outboxDirectory = join(root, "outbox");
  const dataDirectory = join(root, "data");
  const store = await NimantoStore.open(dataDirectory);
  stores.push(store);
  const identity = await store.createLocalTenant(`${label}@example.test`, label);
  const claim = await store.createEvidence(identity.tenantId, {
    kind: "skill",
    value: "TypeScript",
    status: "pending",
    confidence: "high",
    sourceName: "Synthetic resume",
    locator: "line:1",
  });
  await store.confirmEvidence(identity.tenantId, claim.id);
  const profile = await store.saveProfileVersion(identity.tenantId, "Authorized to work.");
  const job = await store.upsertJob(identity.tenantId, {
    source: "manual",
    sourceJobId: `${label}-job`,
    title: "Engineer",
    company: "Synthetic Works",
    description: "Build systems",
    location: "",
    workMode: "unspecified",
    url: "",
    requirements: [],
    capability: "deep_link",
    sourceMeta: {},
    contentHash: `${label}-content`,
  });
  const application = await store.createApplication(identity.tenantId, job.id, profile.version.id);
  await publishMatch(store, identity.tenantId, job.id, "manual");
  return {
    root,
    dataDirectory,
    artifactDirectory,
    outboxDirectory,
    store,
    identity,
    job,
    application,
    evidenceIds: [claim.id],
  };
}

describe("packet lifecycle staging", () => {
  it("cleans render failures and serializes tenant staging with deletion", async () => {
    const { store, identity, application, evidenceIds, artifactDirectory, outboxDirectory } =
      await packetFixture("packet-staging");
    const failingRenderer: PacketArtifactRenderer = async (_packetId, _packet, directory) => {
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "candidate-name.txt"), "Packet Staging");
      throw new Error("INJECTED_RENDER_FAILURE");
    };
    const lifecycle = new PacketLifecycle(store, artifactDirectory, undefined, failingRenderer);

    await expect(
      lifecycle.create({
        tenantId: identity.tenantId,
        applicationId: application.id,
        candidateName: "Packet Staging",
        evidenceIds,
      }),
    ).rejects.toThrow("INJECTED_RENDER_FAILURE");
    const stagingRoot = join(artifactDirectory, identity.tenantId, ".staging");
    expect(await readdir(stagingRoot)).toEqual([]);

    const interrupted = join(stagingRoot, "interrupted");
    await mkdir(interrupted, { recursive: true });
    await writeFile(join(interrupted, "candidate-name.txt"), "Packet Staging");

    let releaseRender!: () => void;
    let reportRenderStarted!: () => void;
    const renderMayFinish = new Promise<void>((resolve) => {
      releaseRender = resolve;
    });
    const renderStarted = new Promise<void>((resolve) => {
      reportRenderStarted = resolve;
    });
    const pausedRenderer: PacketArtifactRenderer = async (packetId, packet, directory) => {
      reportRenderStarted();
      await renderMayFinish;
      return renderPacketArtifacts(packetId, packet, directory);
    };
    const packetPromise = new PacketLifecycle(
      store,
      artifactDirectory,
      undefined,
      pausedRenderer,
    ).create({
      tenantId: identity.tenantId,
      applicationId: application.id,
      candidateName: "Packet Staging",
      evidenceIds,
    });
    await renderStarted;
    let deletionSettled = false;
    const deletionPromise = new DeletionCoordinator(store, artifactDirectory, outboxDirectory)
      .start(identity.tenantId)
      .then((result) => {
        deletionSettled = true;
        return result;
      });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(deletionSettled).toBe(false);

    releaseRender();
    await expect(packetPromise).resolves.toMatchObject({ status: "draft" });
    await expect(deletionPromise).resolves.toMatchObject({ pending: false });
    await expect(access(join(artifactDirectory, identity.tenantId))).rejects.toThrow();
  });

  it("rejects changed frozen inputs before rendering any candidate artifact", async () => {
    const { store, identity, application, evidenceIds, artifactDirectory } =
      await packetFixture("packet-input-change");
    const wrapped = new Proxy(store, {
      get(target, property) {
        if (property === "transaction") {
          return async <T>(work: (database: NimantoStore) => Promise<T>) =>
            store.transaction((database) =>
              work(
                new Proxy(database, {
                  get(transactionTarget, transactionProperty) {
                    if (transactionProperty === "listEvidenceByIds") {
                      return async (tenantId: string, ids: readonly string[]) =>
                        (await database.listEvidenceByIds(tenantId, ids)).map((claim) => ({
                          ...claim,
                          value: `${claim.value} changed`,
                        }));
                    }
                    const transactionValue = Reflect.get(
                      transactionTarget,
                      transactionProperty,
                      transactionTarget,
                    ) as unknown;
                    return typeof transactionValue === "function"
                      ? transactionValue.bind(transactionTarget)
                      : transactionValue;
                  },
                }) as NimantoStore,
              ),
            );
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as NimantoStore;

    await expect(
      new PacketLifecycle(wrapped, artifactDirectory).create({
        tenantId: identity.tenantId,
        applicationId: application.id,
        candidateName: "Packet Input Change",
        evidenceIds,
      }),
    ).rejects.toThrow("PACKET_INPUT_CHANGED");
    await expect(access(join(artifactDirectory, identity.tenantId))).rejects.toThrow();
  });

  it("reproduces the canonical hash for identical frozen composition inputs", async () => {
    const { store, identity, application, evidenceIds, artifactDirectory } =
      await packetFixture("packet-reproducible");
    const lifecycle = new PacketLifecycle(store, artifactDirectory);

    const first = await lifecycle.create({
      tenantId: identity.tenantId,
      applicationId: application.id,
      candidateName: "Packet Reproducible",
      evidenceIds,
    });
    const second = await lifecycle.create({
      tenantId: identity.tenantId,
      applicationId: application.id,
      candidateName: "Packet Reproducible",
      evidenceIds,
    });

    expect(second.id).not.toBe(first.id);
    expect(second.artifactHash).toBe(first.artifactHash);
    expect(second.canonicalContent).toEqual(first.canonicalContent);
    expect(second.canonicalContent).toMatchObject({
      schemaVersion: "packet_v2",
      composition: { evidenceIds },
    });
    expect(second.canonicalContent).not.toHaveProperty("generatedAt");
  });

  it("does not erase candidate-recorded submission or withdrawal facts", async () => {
    const { store, identity, application, evidenceIds, artifactDirectory } =
      await packetFixture("packet-candidate-facts");
    const lifecycle = new PacketLifecycle(store, artifactDirectory);
    const submitted = await store.setApplicationStatus(
      identity.tenantId,
      application.id,
      "submitted_externally",
    );
    expect(submitted?.submittedAt).toEqual(expect.any(String));

    const packet = await lifecycle.create({
      tenantId: identity.tenantId,
      applicationId: application.id,
      candidateName: "Packet Candidate Facts",
      evidenceIds,
    });
    const afterGeneration = (await store.listApplications(identity.tenantId)).find(
      (candidate) => candidate.id === application.id,
    );
    expect(afterGeneration).toMatchObject({
      status: "submitted_externally",
      submittedAt: submitted?.submittedAt,
    });

    await expect(lifecycle.assure(identity.tenantId, packet.id)).resolves.toMatchObject({
      status: "passed",
    });
    await expect(
      store.transitionCandidateApplicationStatus(
        identity.tenantId,
        application.id,
        "withdrawn",
        true,
      ),
    ).resolves.toMatchObject({ status: "withdrawn" });
    await expect(lifecycle.approve(identity.tenantId, packet.id)).resolves.toMatchObject({
      status: "approved",
    });
    await expect(store.listApplications(identity.tenantId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: application.id, status: "withdrawn", submittedAt: null }),
      ]),
    );
  });

  it("refuses to approve a packet that is no longer the latest for its Application", async () => {
    const { store, identity, application, evidenceIds, artifactDirectory } =
      await packetFixture("packet-not-current");
    const lifecycle = new PacketLifecycle(store, artifactDirectory);
    const compose = async (label: string) =>
      lifecycle.create({
        tenantId: identity.tenantId,
        applicationId: application.id,
        candidateName: label,
        evidenceIds,
      });

    const first = await compose("Packet Not Current A");
    await expect(lifecycle.assure(identity.tenantId, first.id)).resolves.toMatchObject({
      status: "passed",
    });
    await compose("Packet Not Current B");
    const latest = await compose("Packet Not Current C");
    expect(latest.id).not.toBe(first.id);

    await expect(lifecycle.approve(identity.tenantId, first.id)).rejects.toThrow(
      "PACKET_NOT_CURRENT",
    );
    await expect(store.getPacket(identity.tenantId, first.id)).resolves.toMatchObject({
      status: "assurance_passed",
    });
    await expect(store.listApplications(identity.tenantId)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: application.id, status: "prepared" })]),
    );

    await expect(lifecycle.assure(identity.tenantId, latest.id)).resolves.toMatchObject({
      status: "passed",
    });
    await expect(lifecycle.approve(identity.tenantId, latest.id)).resolves.toMatchObject({
      status: "approved",
    });
  });

  it("refuses to approve a packet whose Profile Version was superseded, and recovers after a rebind", async () => {
    const { store, identity, application, evidenceIds, artifactDirectory } =
      await packetFixture("packet-stale-profile");
    const lifecycle = new PacketLifecycle(store, artifactDirectory);

    const packet = await lifecycle.create({
      tenantId: identity.tenantId,
      applicationId: application.id,
      candidateName: "Packet Stale Profile",
      evidenceIds,
    });
    await expect(lifecycle.assure(identity.tenantId, packet.id)).resolves.toMatchObject({
      status: "passed",
    });

    // A new Profile Version supersedes the one the packet froze. The packet is
    // still the latest packet for the Application, so the old newest-packet
    // check would let it through; the deeper currency rule must not.
    await store.saveProfileVersion(identity.tenantId, "Authorized to work. Revised.");

    await expect(lifecycle.approve(identity.tenantId, packet.id)).rejects.toThrow(
      "PACKET_NOT_CURRENT",
    );
    await expect(store.getPacket(identity.tenantId, packet.id)).resolves.toMatchObject({
      status: "assurance_passed",
    });
    await expect(store.listApplications(identity.tenantId)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: application.id, status: "prepared" })]),
    );

    // The documented recovery: rebind to the current Profile Version, republish
    // the Match, recompose and assure, then approve succeeds.
    await lifecycle.rebindProfileVersion(identity.tenantId, application.id);
    await publishMatch(store, identity.tenantId, application.jobId, "manual");
    const recomposed = await lifecycle.create({
      tenantId: identity.tenantId,
      applicationId: application.id,
      candidateName: "Packet Stale Profile Recomposed",
      evidenceIds,
    });
    await expect(lifecycle.assure(identity.tenantId, recomposed.id)).resolves.toMatchObject({
      status: "passed",
    });
    await expect(lifecycle.approve(identity.tenantId, recomposed.id)).resolves.toMatchObject({
      status: "approved",
    });
  });

  it("removes promoted artifacts when the database transaction fails", async () => {
    const fixture = await packetFixture("packet-transaction-failure");
    stores.pop();
    await fixture.store.close();
    const raw = await PGlite.create(fixture.dataDirectory);
    await raw.exec(String.raw`
      CREATE FUNCTION nimanto_inject_packet_failure()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'INJECTED_PACKET_FAILURE';
      END;
      $$;
      CREATE TRIGGER nimanto_test_packet_failure
      BEFORE INSERT ON packets
      FOR EACH ROW EXECUTE FUNCTION nimanto_inject_packet_failure();
    `);
    await raw.close();
    const reopened = await NimantoStore.open(fixture.dataDirectory);
    stores.push(reopened);

    await expect(
      new PacketLifecycle(reopened, fixture.artifactDirectory).create({
        tenantId: fixture.identity.tenantId,
        applicationId: fixture.application.id,
        candidateName: "Packet Transaction Failure",
        evidenceIds: fixture.evidenceIds,
      }),
    ).rejects.toThrow("INJECTED_PACKET_FAILURE");
    const tenantDirectory = join(fixture.artifactDirectory, fixture.identity.tenantId);
    expect(await readdir(tenantDirectory)).toEqual([".staging"]);
    expect(await readdir(join(tenantDirectory, ".staging"))).toEqual([]);
  });
});
