import { access, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { NimantoStore } from "@nimanto/database";
import { renderPacketArtifacts } from "@nimanto/documents";
import { DeletionCoordinator } from "../src/deletion-coordinator.js";
import { PacketLifecycle, type PacketArtifactRenderer } from "../src/packet-lifecycle.js";

const stores: NimantoStore[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

async function packetFixture(label: string) {
  const root = await mkdtemp(join(tmpdir(), `nimanto-packet-${label}-`));
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
  return {
    root,
    dataDirectory,
    artifactDirectory,
    outboxDirectory,
    store,
    identity,
    job,
    application,
  };
}

describe("packet lifecycle staging", () => {
  it("cleans render failures and serializes tenant staging with deletion", async () => {
    const { store, identity, application, artifactDirectory, outboxDirectory } =
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
    const { store, identity, application, artifactDirectory } =
      await packetFixture("packet-input-change");
    const wrapped = new Proxy(store, {
      get(target, property) {
        if (property === "transaction") {
          return async <T>(work: (database: NimantoStore) => Promise<T>) =>
            store.transaction((database) =>
              work(
                new Proxy(database, {
                  get(transactionTarget, transactionProperty) {
                    if (transactionProperty === "listApplications") {
                      return async (tenantId: string) =>
                        (await database.listApplications(tenantId)).map((candidate) =>
                          candidate.id === application.id && candidate.job
                            ? {
                                ...candidate,
                                job: {
                                  ...candidate.job,
                                  description: "Changed after the first snapshot",
                                  contentHash: "changed-content",
                                },
                              }
                            : candidate,
                        );
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
      }),
    ).rejects.toThrow("PACKET_INPUT_CHANGED");
    await expect(access(join(artifactDirectory, identity.tenantId))).rejects.toThrow();
  });

  it("does not erase candidate-recorded submission or withdrawal facts", async () => {
    const { store, identity, application, artifactDirectory } =
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
      }),
    ).rejects.toThrow("INJECTED_PACKET_FAILURE");
    const tenantDirectory = join(fixture.artifactDirectory, fixture.identity.tenantId);
    expect(await readdir(tenantDirectory)).toEqual([".staging"]);
    expect(await readdir(join(tenantDirectory, ".staging"))).toEqual([]);
  });
});
