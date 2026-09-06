import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { ApplicationRecord, NimantoStore, PacketRecord } from "@nimanto/database";
import {
  inspectPacketArtifacts,
  type CanonicalPacket,
  type DocumentInspection,
  renderPacketArtifacts,
} from "@nimanto/documents";
import {
  applicationTransitions,
  assurePacket,
  canonicalHash,
  createReceipt,
  type ApplicationStatus,
  type PacketApplicationEffect,
} from "@nimanto/domain";
import { localModelInventory, reviewLocalPacket } from "@nimanto/providers";

export type ArtifactManifest = {
  artifacts?: Array<{ format: string; filename: string; sha256: string }>;
  documentInspection?: DocumentInspection;
};

export type PacketArtifactRenderer = typeof renderPacketArtifacts;
export type PacketArtifactInspector = typeof inspectPacketArtifacts;

export async function verifiedArtifactBytes(
  artifactDirectory: string,
  tenantId: string,
  packetId: string,
  artifact: { filename: string; sha256: string },
): Promise<Buffer> {
  if (
    path.basename(artifact.filename) !== artifact.filename ||
    !/^[a-f0-9]{64}$/u.test(artifact.sha256)
  ) {
    throw new Error("ARTIFACT_INTEGRITY_FAILED");
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(path.join(artifactDirectory, tenantId, packetId, artifact.filename));
  } catch {
    throw new Error("ARTIFACT_INTEGRITY_FAILED");
  }
  if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) {
    throw new Error("ARTIFACT_INTEGRITY_FAILED");
  }
  return bytes;
}

export async function verifyPacketArtifacts(
  artifactDirectory: string,
  tenantId: string,
  packetId: string,
  manifest: ArtifactManifest,
): Promise<void> {
  if (!manifest.artifacts?.length) throw new Error("ARTIFACT_INTEGRITY_FAILED");
  await Promise.all(
    manifest.artifacts.map((artifact) =>
      verifiedArtifactBytes(artifactDirectory, tenantId, packetId, artifact),
    ),
  );
}

export class PacketLifecycle {
  constructor(
    private readonly store: NimantoStore,
    private readonly artifactDirectory: string,
    private readonly assuranceModel?: string,
    private readonly renderArtifacts: PacketArtifactRenderer = renderPacketArtifacts,
    private readonly inspectArtifacts: PacketArtifactInspector = inspectPacketArtifacts,
  ) {}

  private async applyApplicationEffect(
    database: NimantoStore,
    tenantId: string,
    applicationId: string,
    currentStatus: ApplicationStatus,
    effect: PacketApplicationEffect,
  ): Promise<ApplicationRecord | null> {
    const decision = applicationTransitions.packet(currentStatus, effect);
    if (decision.kind === "candidate_status_preserved" || decision.kind === "unchanged") {
      return null;
    }
    const application = await database.setApplicationStatus(tenantId, applicationId, decision.to);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    return application;
  }

  /** Candidate-initiated rebind of an Application to the current Profile
   * Version. One tenant lock covers the rebind, its status consequence, and its
   * receipt; packets, assurance runs, and Submission Records stay untouched and
   * an already-current Application is a no-op. */
  async rebindProfileVersion(tenantId: string, applicationId: string): Promise<ApplicationRecord> {
    return this.store.transaction(async (database) => {
      const outcome = await database.rebindApplicationProfileVersion(tenantId, applicationId);
      if (!outcome.rebound) return outcome.application;
      const moved = await this.applyApplicationEffect(
        database,
        tenantId,
        applicationId,
        outcome.application.status,
        "profile_rebound",
      );
      const receipt = createReceipt({
        id: randomUUID(),
        type: "application.profile_rebound",
        occurredAt: new Date().toISOString(),
        input: {
          applicationId,
          fromProfileVersionId: outcome.fromProfileVersionId,
          toProfileVersionId: outcome.toProfileVersionId,
        },
        artifact: { profileVersionId: outcome.toProfileVersionId },
      });
      await database.saveReceipt(tenantId, receipt, { applicationId });
      return moved ?? outcome.application;
    });
  }

  private async inputs(
    database: NimantoStore,
    tenantId: string,
    applicationId: string,
    evidenceIds: readonly string[],
  ) {
    if (
      evidenceIds.length === 0 ||
      evidenceIds.length > 8 ||
      new Set(evidenceIds).size !== evidenceIds.length
    ) {
      throw new Error("INVALID_PACKET_EVIDENCE_SELECTION");
    }
    const application = (await database.listApplications(tenantId)).find(
      (candidate) => candidate.id === applicationId,
    );
    if (!application?.job) throw new Error("APPLICATION_NOT_FOUND");
    if (!application.profileVersionId) throw new Error("PROFILE_VERSION_REQUIRED");
    const profile = await database.getProfileVersion(tenantId, application.profileVersionId);
    if (!profile) throw new Error("PROFILE_VERSION_REQUIRED");
    if (evidenceIds.some((id) => !profile.claimIds.includes(id))) {
      throw new Error("PACKET_EVIDENCE_OUTSIDE_PROFILE");
    }
    const loadedEvidence = await database.listEvidenceByIds(tenantId, evidenceIds);
    const evidenceById = new Map(loadedEvidence.map((claim) => [claim.id, claim]));
    const evidence = evidenceIds.flatMap((id) => {
      const claim = evidenceById.get(id);
      return claim ? [claim] : [];
    });
    if (
      evidence.length !== evidenceIds.length ||
      evidence.some((claim) => claim.status !== "confirmed")
    ) {
      throw new Error("PROFILE_EVIDENCE_CHANGED");
    }
    const match = (await database.listLatestMatches(tenantId)).find(
      (candidate) => candidate.jobId === application.jobId,
    );
    if (!match) throw new Error("MATCH_PUBLICATION_REQUIRED");
    const job = await database.getJob(tenantId, application.jobId);
    if (!job || match.profileVersionId !== profile.id || match.jobContentHash !== job.contentHash) {
      throw new Error("PACKET_MATCH_INPUT_CHANGED");
    }
    return { application, profile, evidence, match, job };
  }

  async create(input: {
    tenantId: string;
    applicationId: string;
    candidateName: string;
    contactEmail?: string;
    evidenceIds: string[];
  }): Promise<PacketRecord> {
    const snapshot = await this.inputs(
      this.store,
      input.tenantId,
      input.applicationId,
      input.evidenceIds,
    );
    const packetId = randomUUID();
    const inputHash = canonicalHash({
      applicationId: input.applicationId,
      candidateName: input.candidateName,
      contactEmail: input.contactEmail ?? "",
      job: { id: snapshot.job.id, contentHash: snapshot.job.contentHash },
      profile: { id: snapshot.profile.id, inputHash: snapshot.profile.inputHash },
      match: {
        id: snapshot.match.id,
        inputHash: snapshot.match.inputHash,
        artifactHash: snapshot.match.artifactHash,
      },
      evidence: snapshot.evidence,
      evidenceIds: input.evidenceIds,
    });
    const packet: CanonicalPacket = {
      schemaVersion: "packet_v2",
      candidateName: input.candidateName,
      destination: {
        company: snapshot.application.job!.company,
        role: snapshot.application.job!.title,
        ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
      },
      summary: `${input.candidateName} selected ${snapshot.evidence.length} confirmed evidence item${snapshot.evidence.length === 1 ? "" : "s"} for this application.`,
      claims: snapshot.evidence.map((claim) => ({ text: claim.value, evidenceIds: [claim.id] })),
      authorizationWording: snapshot.profile.authorizationWording,
      composition: {
        inputHash,
        profileVersionId: snapshot.profile.id,
        matchRunId: snapshot.match.id,
        matchInputHash: snapshot.match.inputHash,
        matchArtifactHash: snapshot.match.artifactHash,
        jobContentHash: snapshot.job.contentHash,
        evidenceIds: [...input.evidenceIds],
      },
    };
    const staging = path.join(this.artifactDirectory, input.tenantId, ".staging", packetId);
    const finalDirectory = path.join(this.artifactDirectory, input.tenantId, packetId);
    let promoted = false;
    try {
      return await this.store.transaction(async (database) => {
        await database.lockTenantActive(input.tenantId);
        const current = await this.inputs(
          database,
          input.tenantId,
          input.applicationId,
          input.evidenceIds,
        );
        const currentHash = canonicalHash({
          applicationId: input.applicationId,
          candidateName: input.candidateName,
          contactEmail: input.contactEmail ?? "",
          job: { id: current.job.id, contentHash: current.job.contentHash },
          profile: { id: current.profile.id, inputHash: current.profile.inputHash },
          match: {
            id: current.match.id,
            inputHash: current.match.inputHash,
            artifactHash: current.match.artifactHash,
          },
          evidence: current.evidence,
          evidenceIds: input.evidenceIds,
        });
        if (currentHash !== inputHash) throw new Error("PACKET_INPUT_CHANGED");
        await mkdir(path.dirname(finalDirectory), { recursive: true, mode: 0o700 });
        const artifacts = await this.renderArtifacts(packetId, packet, staging);
        const documentInspection = await this.inspectArtifacts(packetId, packet, artifacts);
        const manifest: ArtifactManifest = {
          artifacts: artifacts.map(({ format, filename, sha256 }) => ({
            format,
            filename,
            sha256,
          })),
          documentInspection,
        };
        await rename(staging, finalDirectory);
        promoted = true;
        const saved = await database.createPacket(input.tenantId, {
          id: packetId,
          applicationId: input.applicationId,
          profileVersionId: current.profile.id,
          canonicalContent: packet as unknown as Record<string, unknown>,
          artifactManifest: manifest as unknown as Record<string, unknown>,
        });
        await this.applyApplicationEffect(
          database,
          input.tenantId,
          input.applicationId,
          current.application.status,
          "packet_generated",
        );
        const receipt = createReceipt({
          id: randomUUID(),
          type: "packet.generated",
          occurredAt: new Date().toISOString(),
          input: {
            applicationId: input.applicationId,
            profileVersionId: current.profile.id,
            evidenceIds: [...input.evidenceIds],
            matchRunId: current.match.id,
            jobContentHash: current.job.contentHash,
            inputHash,
          },
          artifact: {
            packetId,
            packetHash: saved.artifactHash,
            manifestHash: saved.manifestHash,
            documentInspection: documentInspection.status,
          },
        });
        await database.saveReceipt(input.tenantId, receipt, {
          packetId,
          applicationId: input.applicationId,
          artifactHashes: manifest.artifacts,
        });
        return saved;
      });
    } catch (error) {
      await rm(promoted ? finalDirectory : staging, { recursive: true, force: true });
      throw error;
    }
  }

  async assure(tenantId: string, packetId: string) {
    const packet = await this.store.getPacket(tenantId, packetId);
    if (!packet) throw new Error("PACKET_NOT_FOUND");
    const manifest = packet.artifactManifest as ArtifactManifest;
    await verifyPacketArtifacts(this.artifactDirectory, tenantId, packetId, manifest);
    const content = packet.canonicalContent as unknown as CanonicalPacket;
    const evidenceIds = [...new Set(content.claims.flatMap((claim) => claim.evidenceIds))];
    const evidence = await this.store.listEvidenceByIds(tenantId, evidenceIds);
    const profile = packet.profileVersionId
      ? await this.store.getProfileVersion(tenantId, packet.profileVersionId)
      : null;
    const result = assurePacket({
      authorizationWording: content.authorizationWording,
      ...(profile ? { lockedAuthorizationWording: profile.authorizationWording } : {}),
      claims: content.claims,
      confirmedEvidenceIds: evidence
        .filter((claim) => claim.status === "confirmed")
        .map((claim) => claim.id),
      destination: content.destination,
    });
    const documentFindings = (manifest.documentInspection?.checks ?? [])
      .filter((check) => check.status === "blocked")
      .map((check) => ({
        code: check.code,
        severity: "required" as const,
        message: `${check.format ?? "packet"}: ${check.detail}`,
      }));
    if (!manifest.documentInspection) {
      documentFindings.push({
        code: "DOCUMENT_INSPECTION_REQUIRED",
        severity: "required",
        message: "The frozen packet is missing its deterministic document inspection report.",
      });
    }
    const modelFindings: Array<{ code: string; severity: "required"; message: string }> = [];
    let modelRule = "model_review_not_configured";
    if (this.assuranceModel) {
      try {
        const configured = (await localModelInventory()).find(
          (model) => model.name === this.assuranceModel,
        );
        if (!configured) throw new Error("MODEL_UNAVAILABLE");
        const review = await reviewLocalPacket({ model: configured, packet: content });
        modelRule = `${review.reviewerVersion}:${review.model}@${review.digest}`;
        if (review.verdict === "block") {
          modelFindings.push(
            ...(review.findings.length
              ? review.findings
              : ["The local reviewer blocked approval."]
            ).map((message) => ({
              code: "MODEL_REVIEW_BLOCKED",
              severity: "required" as const,
              message,
            })),
          );
        }
      } catch {
        modelFindings.push({
          code: "MODEL_REVIEW_BLOCKED_UNAVAILABLE",
          severity: "required",
          message: `Configured local reviewer ${this.assuranceModel} is unavailable or invalid; no fallback was used.`,
        });
        modelRule = "ollama_packet_review_v1:blocked_unavailable";
      }
    }
    return this.store.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const current = await database.getPacket(tenantId, packetId);
      if (
        !current ||
        current.artifactHash !== packet.artifactHash ||
        current.manifestHash !== packet.manifestHash
      ) {
        throw new Error("PACKET_CHANGED");
      }
      await verifyPacketArtifacts(this.artifactDirectory, tenantId, packetId, manifest);
      const saved = await database.saveAssurance(tenantId, packetId, {
        status:
          result.status === "passed" && documentFindings.length === 0 && modelFindings.length === 0
            ? "passed"
            : "blocked",
        ruleVersion: `${result.ruleVersion}+document_assurance_v1+${modelRule}`,
        findings: [...result.findings, ...documentFindings, ...modelFindings],
        packetArtifactHash: packet.artifactHash,
        manifestHash: packet.manifestHash,
      });
      const receipt = createReceipt({
        id: randomUUID(),
        type: "packet.assured",
        occurredAt: new Date().toISOString(),
        input: { packetId, packetHash: packet.artifactHash, manifestHash: packet.manifestHash },
        artifact: {
          assuranceId: saved.id,
          status: saved.status,
          ruleVersion: saved.ruleVersion,
          findingCodes: (saved.findings as Array<{ code?: unknown }>).map((finding) =>
            String(finding.code ?? "UNKNOWN"),
          ),
        },
      });
      await database.saveReceipt(tenantId, receipt, {
        packetId,
        assuranceId: saved.id,
        packetArtifactHash: saved.packetArtifactHash,
        manifestHash: saved.manifestHash,
      });
      return saved;
    });
  }

  async approve(tenantId: string, packetId: string) {
    return this.store.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const pending = await database.getPacket(tenantId, packetId);
      if (!pending) throw new Error("PACKET_NOT_FOUND");
      const latest = await database.getLatestPacketForApplication(tenantId, pending.applicationId);
      if (latest?.id !== packetId) throw new Error("PACKET_NOT_CURRENT");
      // Being the newest packet is not enough: every consumer of the approval
      // (external actions, submissions) checks the deeper currency rule, so
      // approving a packet whose Profile Version or Match has been superseded
      // would move the Application to approved_for_export and then be refused
      // downstream. Gate on the same rule the consumers use.
      if (!(await database.isPacketCurrent(tenantId, packetId)))
        throw new Error("PACKET_NOT_CURRENT");
      const application = (await database.listApplications(tenantId)).find(
        (candidate) => candidate.id === pending.applicationId,
      );
      if (!application) throw new Error("APPLICATION_NOT_FOUND");
      await verifyPacketArtifacts(
        this.artifactDirectory,
        tenantId,
        packetId,
        pending.artifactManifest as ArtifactManifest,
      );
      const assurance = await database.latestAssurance(tenantId, packetId);
      if (!assurance || assurance.status !== "passed") throw new Error("ASSURANCE_REQUIRED");
      const packet = await database.approvePacketExact(
        tenantId,
        packetId,
        assurance.id,
        pending.artifactHash,
        pending.manifestHash,
      );
      await this.applyApplicationEffect(
        database,
        tenantId,
        packet.applicationId,
        application.status,
        "packet_approved",
      );
      const receipt = createReceipt({
        id: randomUUID(),
        type: "packet.approved",
        occurredAt: new Date().toISOString(),
        input: { packetId, assuranceId: assurance.id },
        artifact: {
          packetHash: packet.artifactHash,
          manifestHash: packet.manifestHash,
          approvedAt: packet.approvedAt,
        },
      });
      await database.saveReceipt(tenantId, receipt, {
        packetId,
        assuranceId: assurance.id,
        artifactManifest: packet.artifactManifest,
      });
      return packet;
    });
  }
}
