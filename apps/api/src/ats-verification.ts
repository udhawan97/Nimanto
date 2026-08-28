import type { NimantoStore } from "@nimanto/database";
import {
  routeAtsLink,
  verifyProviderJob,
  type ProviderJobVerificationResult,
} from "@nimanto/providers";

type EnabledAtsProvider = "greenhouse" | "lever" | "ashby";
type VerificationRequest = {
  provider: EnabledAtsProvider;
  board: string;
  sourceJobId: string;
};
const VERIFICATION_POLICY_VERSION = "ats_verification_v1";

export type ProviderJobVerifier = (
  request: VerificationRequest,
) => Promise<ProviderJobVerificationResult>;

function routeFor(job: Awaited<ReturnType<NimantoStore["getJob"]>>) {
  if (!job) throw new Error("JOB_NOT_FOUND");
  return routeAtsLink({
    source: job.source,
    sourceJobId: job.sourceJobId,
    url: job.url,
    sourceMeta: job.sourceMeta,
  });
}

function enabledProvider(value: string | null): EnabledAtsProvider | null {
  return value === "greenhouse" || value === "lever" || value === "ashby" ? value : null;
}

function providerErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^(?:PROVIDER|SOURCE|INVALID)_[A-Z0-9_]+$/u.test(message)
    ? message
    : "PROVIDER_VERIFICATION_FAILED";
}

/** Candidate-triggered liveness verification for an exact, already-approved
 * ATS route. This is separate from Action Intent: it reads public posting state
 * and records evidence, but never applies, sends, or follows a redirect. */
export class AtsVerification {
  constructor(
    private readonly store: NimantoStore,
    private readonly verify: ProviderJobVerifier = verifyProviderJob,
  ) {}

  async request(tenantId: string, jobId: string) {
    const before = await this.store.getJob(tenantId, jobId);
    const route = routeFor(before);
    const provider = enabledProvider(route.provider);
    if (
      route.state !== "ready" ||
      route.verificationState !== "ready" ||
      !provider ||
      !route.boardId ||
      !route.sourceJobId ||
      !route.verificationMethod
    ) {
      throw new Error(route.state === "gated" ? "ATS_ROUTE_GATED" : "ATS_ROUTE_UNAVAILABLE");
    }

    let result: ProviderJobVerificationResult;
    try {
      result = await this.verify({
        provider,
        board: route.boardId,
        sourceJobId: route.sourceJobId,
      });
      if (
        result.provider !== provider ||
        result.boardId !== route.boardId ||
        result.sourceJobId !== route.sourceJobId ||
        result.method !== route.verificationMethod
      ) {
        throw new Error("PROVIDER_VERIFICATION_IDENTITY_MISMATCH");
      }
    } catch (error) {
      const current = await this.store.getJob(tenantId, jobId);
      const currentRoute = routeFor(current);
      if (
        currentRoute.state !== "ready" ||
        currentRoute.verificationState !== "ready" ||
        currentRoute.provider !== route.provider ||
        currentRoute.boardId !== route.boardId ||
        currentRoute.sourceJobId !== route.sourceJobId
      ) {
        throw new Error("ATS_ROUTE_CHANGED");
      }
      return this.store.recordRoleVerification(tenantId, jobId, {
        attemptedAt: new Date().toISOString(),
        method: route.verificationMethod,
        result: "blocked",
        evidence: {
          provider,
          boardId: route.boardId,
          sourceJobId: route.sourceJobId,
          errorCode: providerErrorCode(error),
          ruleVersion: route.ruleVersion,
          verificationPolicyVersion: VERIFICATION_POLICY_VERSION,
        },
      });
    }

    const current = await this.store.getJob(tenantId, jobId);
    const currentRoute = routeFor(current);
    if (
      currentRoute.state !== "ready" ||
      currentRoute.verificationState !== "ready" ||
      currentRoute.provider !== route.provider ||
      currentRoute.boardId !== route.boardId ||
      currentRoute.sourceJobId !== route.sourceJobId
    ) {
      throw new Error("ATS_ROUTE_CHANGED");
    }
    return this.store.recordRoleVerification(tenantId, jobId, {
      attemptedAt: result.completedAt,
      method: result.method,
      result: result.result,
      evidence: {
        provider: result.provider,
        boardId: result.boardId,
        sourceJobId: result.sourceJobId,
        startedAt: result.attemptedAt,
        responseFingerprint: result.responseFingerprint,
        sourceItemCount: result.sourceItemCount,
        failureCode: result.failureCode,
        ruleVersion: route.ruleVersion,
        verificationPolicyVersion: VERIFICATION_POLICY_VERSION,
      },
    });
  }
}
