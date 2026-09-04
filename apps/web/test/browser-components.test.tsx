import { act, createElement, type ReactNode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../components/command-palette.js";
import { CopyLine } from "../components/copy-line.js";
import { DeletionReceiptGuidance } from "../components/deletion-receipt-guidance.js";
import { ErrorBoundary } from "../components/error-boundary.js";
import { H1bEvidencePanel } from "../components/h1b-evidence.js";
import {
  ApplicationSubmissionRecorder,
  createSubmissionDraft,
} from "../components/application-submission.js";
import { AnswerHistoryDetails, AnswerRevisionHistory } from "../components/career-ledger.js";
import { PacketComposer } from "../components/packet-composer.js";
import { RoleProvenanceCard } from "../components/role-provenance.js";
import { RoleIdentityReviewNotice } from "../components/role-identity-review.js";
import { isLoopbackHost, serviceWorkerScriptUrl } from "../components/service-worker.js";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render(node: ReactNode): Promise<HTMLDivElement> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(node));
  return host;
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  Reflect.deleteProperty(navigator, "clipboard");
  root = null;
  host = null;
  vi.restoreAllMocks();
});

describe("recovery boundary", () => {
  it("does not tell the candidate that an interrupted action definitely failed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Broken(): ReactNode {
      throw new Error("render failed");
    }

    const view = await render(createElement(ErrorBoundary, null, createElement(Broken)));

    expect(view.textContent).toContain("does not establish whether the last action completed");
    expect(view.textContent).toContain("review the current record before retrying");
    expect(view.textContent).not.toContain("Nothing was sent");
    expect(view.querySelector("details")?.open).toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("copy feedback", () => {
  it("confirms a successful clipboard write", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const view = await render(createElement(CopyLine, { command: "pnpm dev" }));

    await act(async () => view.querySelector("button")?.click());

    expect(writeText).toHaveBeenCalledWith("pnpm dev");
    expect(view.querySelector("button")?.textContent).toContain("Copied");
  });

  it("reports a rejected clipboard write instead of failing silently", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const view = await render(createElement(CopyLine, { command: "pnpm dev" }));

    await act(async () => view.querySelector("button")?.click());

    expect(view.querySelector("button")?.textContent).toContain("Copy failed");
    expect(view.querySelector("button")?.dataset.state).toBe("failed");
  });
});

describe("deletion receipt guidance", () => {
  it("distinguishes public token recovery from internal startup cleanup", async () => {
    const view = await render(
      createElement(DeletionReceiptGuidance, { token: "private-deletion-token" }),
    );

    expect(view.textContent).toContain("only public credential");
    expect(view.textContent).toContain("without a session");
    expect(view.textContent).toContain("internally when its local service starts");
    expect(view.textContent).toContain("does not require you to provide the token");
    expect(view.textContent).toContain("Treat the token like a password");
    expect(view.textContent).toContain("Not shown again after you leave this screen.");
    expect([...view.querySelectorAll("code")].map((code) => code.textContent)).toEqual(
      expect.arrayContaining([
        "private-deletion-token",
        "GET /v1/deletion/status?token=…",
        "POST /v1/deletion/resume",
        '{"token":"…"}',
      ]),
    );
  });
});

describe("role source provenance", () => {
  it("keeps exact source, timing, verification, run, integrity, and retention facts distinct", async () => {
    const view = await render(
      createElement(RoleProvenanceCard, {
        source: "greenhouse",
        sourceJobId: "17001",
        boardId: "northwind",
        contentHash: "current-content-hash-123456",
        localUpdatedAt: "2026-08-28T10:01:00.000Z",
        availability: {
          lastSeenAt: "2026-08-28T09:00:30.000Z",
          lastVerifiedAt: "2026-08-28T10:00:00.000Z",
          sourcePostedAt: "2026-08-27T12:00:00.000Z",
          sourceUpdatedAt: "2026-08-28T08:00:00.000Z",
          verificationHealth: "verified",
          verificationAuthority: "employer_ats",
          verificationMethod: "detail_get",
        },
        provenance: {
          observation: {
            id: "observation-1",
            sourceRunId: "run-1",
            observedAt: "2026-08-28T09:00:30.000Z",
            contentHash: "normalized-content-hash-123456",
            sourcePayloadHash: "source-payload-hash-123456",
            normalizerVersion: "role_normalizer_v2",
          },
          verificationAttempt: {
            id: "attempt-1",
            sourceRunId: null,
            attemptedAt: "2026-08-28T10:00:00.000Z",
            authority: "employer_ats",
            method: "detail_get",
            result: "present",
            responseFingerprint: "detail-response-fingerprint-123456",
            policyVersion: "ats_verification_v1",
            failureCode: null,
          },
          sourceRun: {
            id: "run-1",
            source: "greenhouse",
            boardId: "northwind",
            startedAt: "2026-08-28T09:00:00.000Z",
            completedAt: "2026-08-28T09:01:00.000Z",
            complete: true,
            pagesRead: 1,
            sourceItemCount: 3,
            responseFingerprint: "board-response-fingerprint-123456",
            retryAfterObserved: false,
            sourcePolicyVersion: "source_registry_v1",
          },
          verificationSourceRun: {
            id: "run-2",
            source: "greenhouse",
            boardId: "northwind",
            startedAt: "2026-08-28T09:59:00.000Z",
            completedAt: "2026-08-28T10:00:00.000Z",
            complete: false,
            pagesRead: 1,
            sourceItemCount: 1,
            responseFingerprint: "verification-run-fingerprint-123456",
            retryAfterObserved: false,
            sourcePolicyVersion: "ats_verification_v1",
          },
        },
        sourcePolicy: {
          label: "Greenhouse",
          accessClass: "public_api",
          termsUrl: "https://docs.greenhouse.io/job-board.html",
          termsReviewedAt: "2026-08-26",
          commercialUseDecision: "unclear",
          rawBodyTtlHours: 0,
          normalizedRetentionDays: 365,
          deletionUpdateSlaHours: 24,
          attribution: null,
          limitation: "Company-scoped public ATS intake.",
        },
      }),
    );
    const details = view.querySelector("details")!;
    expect(details.open).toBe(false);
    await act(async () => view.querySelector("summary")?.click());
    expect(details.open).toBe(true);
    expect(view.textContent).toContain("Board northwind · Record 17001");
    expect(view.textContent).toContain("Source posted");
    expect(view.textContent).toContain("Source updated");
    expect(view.textContent).toContain("Local record updated");
    expect(view.textContent).toContain("Present · Employer ATS · Detail Get");
    expect(view.textContent).toContain("Observation source run");
    expect(view.textContent).toContain("Complete snapshot");
    expect(view.textContent).toContain("3 source records · 1 page");
    expect(view.textContent).toContain("Verification source run");
    expect(view.textContent).toContain("Partial snapshot");
    expect(view.textContent).toContain("Raw body · not retained");
    expect(view.textContent).toContain("role_normalizer_v2");
    expect(view.querySelector('code[title="source-payload-hash-123456"]')?.textContent).toBe(
      "source-payload-hash-123456".slice(0, 12),
    );
  });
});

describe("migrated manual role identity review", () => {
  it("keeps the quarantine visible and opens review for the exact durable role", async () => {
    const onReview = vi.fn();
    const roleId = "legacy-role-with-application-history";
    const view = await render(
      createElement(RoleIdentityReviewNotice, {
        roleId,
        reason: "legacy_partial_derived_identity",
        editorOpen: false,
        editBlocked: false,
        busy: false,
        onReview,
      }),
    );

    expect(view.textContent).toContain("Candidate review required for this migrated role");
    expect(view.textContent).toContain("exact stored title, company, URL, description");
    expect(view.querySelector("code")?.textContent).toBe(roleId);
    const review = view.querySelector("button")!;
    await act(async () => review.click());
    expect(onReview).toHaveBeenCalledOnce();
  });
});

describe("role H-1B evidence", () => {
  it("separates evidence layers and treats exact-quote review as warning-only", async () => {
    const onSetReviewed = vi.fn();
    const view = await render(
      createElement(H1bEvidencePanel, {
        jobTitle: "Product Engineer",
        jobContentHash: "role-content-hash-current",
        match: {
          id: "match-1",
          jobContentHash: "role-content-hash-current",
          result: {
            ruleVersion: "scoring_rules_v1",
            blockers: [
              {
                code: "no_sponsorship_of_any_kind",
                sourceText: "No sponsorship of any kind",
                sourceLocator: "https://example.test/roles/1",
                observedAt: "2026-08-28T10:00:00.000Z",
              },
            ],
          },
        },
        signals: [
          {
            id: "history-1",
            label: "possible",
            originalLabel: "recent_positive_history",
            sourceType: "dol_oflc_bulk",
            sourceLocator: "fy2026q2:row:17",
            sourcePeriod: "FY2026 Q2",
            observedAt: "2026-07-15T00:00:00.000Z",
            confidence: "low",
            freshness: "current",
            limitations: "Historical filing context only.",
          },
        ],
        reviews: [],
        busy: false,
        onSetReviewed,
      }),
    );

    expect(view.textContent).toContain("Current role wording");
    expect(view.textContent).toContain("Current employer policy");
    expect(view.textContent).toContain("Historical government evidence");
    expect(view.textContent).toContain("No sponsorship of any kind");
    expect(view.textContent).toContain("Historical filing context only.");
    expect(view.textContent).toContain("does not determine eligibility, change fit, or hide");
    expect(view.textContent).not.toContain("Sponsors H-1B");

    const acknowledge = [...view.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Acknowledge exact quote"),
    );
    await act(async () => acknowledge?.click());
    expect(onSetReviewed).toHaveBeenCalledWith({
      matchRunId: "match-1",
      blockerCode: "no_sponsorship_of_any_kind",
      reviewed: true,
    });
  });
});

describe("quick navigation", () => {
  it("keeps a repeated shortcut focused in the open dialog", async () => {
    const view = await render(createElement(CommandPalette));
    const dialog = view.querySelector("dialog")!;
    const showModal = vi.spyOn(dialog, "showModal");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
    expect(view.querySelector('input[aria-label="Search Nimanto"]')).toBe(document.activeElement);
  });

  /* The palette used to cap the list *before* filtering, so a record past the
   * cap could not be found by typing its exact title — in a product whose
   * stated case is "one application among forty". The cap belongs on what
   * reaches the DOM, never on what is searchable. */
  it("searches every entry while capping what it renders", async () => {
    const entries = Array.from({ length: 52 }, (_, index) => ({
      label: `Role ${index + 1}`,
      detail: `Company ${index + 1}`,
      section: "jobs",
    }));
    const view = await render(createElement(CommandPalette, { entries }));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    expect(view.querySelectorAll('[role="option"]')).toHaveLength(40);
    expect(view.textContent).toContain("Showing 40 of 52");

    const input = view.querySelector('input[aria-label="Search Nimanto"]') as HTMLInputElement;
    /* A controlled input ignores a plain `value` write, so go through the native
     * setter React's onChange actually observes. */
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setValue.call(input, "Role 47");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const results = [...view.querySelectorAll('[role="option"]')];
    expect(results).toHaveLength(1);
    expect(results[0]?.textContent).toContain("Role 47");
  });

  /* Arrow keys move a visual highlight and `aria-selected`, but focus never
   * leaves the input. Without the identifier wiring nothing carries the active
   * option to assistive technology, so the highlight is silent. */
  it("announces the active destination while the highlight moves", async () => {
    const view = await render(
      createElement(CommandPalette, {
        entries: [
          { label: "Overview", detail: "Section", section: "overview" },
          { label: "Evidence vault", detail: "Section", section: "evidence" },
        ],
        onNavigate: () => undefined,
      }),
    );
    const trigger = view.querySelector("button.command-trigger") as HTMLButtonElement;
    await act(async () => trigger.click());

    const input = view.querySelector("dialog input") as HTMLInputElement;
    const listbox = view.querySelector('[role="listbox"]') as HTMLElement;
    const options = [...view.querySelectorAll('[role="option"]')] as HTMLElement[];

    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(listbox.id).toBeTruthy();
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(options[0]?.id).toBeTruthy();
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id);

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    const moved = [...view.querySelectorAll('[role="option"]')] as HTMLElement[];
    expect(moved[1]?.getAttribute("aria-selected")).toBe("true");
    expect(
      (view.querySelector("dialog input") as HTMLInputElement).getAttribute(
        "aria-activedescendant",
      ),
    ).toBe(moved[1]?.id);
  });
});

describe("service worker registration policy", () => {
  it.each(["localhost", "localhost.", "app.localhost", "127.0.0.1", "127.20.4.9", "::1", "[::1]"])(
    "treats %s as loopback",
    (hostname) => expect(isLoopbackHost(hostname)).toBe(true),
  );

  it("keeps public hosts eligible and builds base-path-correct script URLs", () => {
    expect(isLoopbackHost("example.github.io")).toBe(false);
    expect(serviceWorkerScriptUrl("")).toBe("/sw.js");
    expect(serviceWorkerScriptUrl("/Nimanto/")).toBe("/Nimanto/sw.js");
  });
});

describe("candidate-controlled packet and submission forms", () => {
  it("starts Packet Composer empty and generates only after an explicit claim selection", async () => {
    const onGenerate = vi.fn();
    const view = await render(
      createElement(PacketComposer, {
        application: { id: "application-1", jobId: "job-1", profileVersionId: "profile-1" },
        profile: { id: "profile-1", claimIds: ["evidence-1"] },
        job: { id: "job-1", contentHash: "role-hash" },
        match: {
          id: "match-1",
          jobId: "job-1",
          profileVersionId: "profile-1",
          jobContentHash: "role-hash",
          result: { requirements: [] },
        },
        evidence: [
          {
            id: "evidence-1",
            status: "confirmed",
            value: "Candidate-selected claim",
            kind: "achievement",
            sourceName: "Resume",
            locator: "line 1",
          },
        ],
        busy: false,
        onGenerate,
      }),
    );
    const generate = [...view.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Generate selected packet"),
    )!;
    expect(view.querySelector("summary")?.textContent).toContain("0/8 selected");
    expect(generate.disabled).toBe(true);
    expect(view.textContent).toContain("does not choose evidence on your behalf");

    const claim = view.querySelector(".packet-evidence-pool button") as HTMLButtonElement;
    await act(async () => claim.click());
    expect(generate.disabled).toBe(false);
    await act(async () => generate.click());
    expect(onGenerate).toHaveBeenCalledWith(["evidence-1"]);
  });

  it("announces and focuses a missing bound-packet format only after an attempted submit", async () => {
    const onConfirm = vi.fn();
    const packet = {
      id: "packet-1",
      status: "approved",
      canonicalContent: { schemaVersion: "packet_v2" },
      artifactManifest: {
        artifacts: [{ format: "json", sha256: "a".repeat(64) }],
      },
    };
    function ControlledRecorder() {
      const [draft, setDraft] = useState(() => createSubmissionDraft(packet));
      return createElement(ApplicationSubmissionRecorder, {
        packet,
        draft,
        busy: false,
        onDraftChange: setDraft,
        onConfirm,
        onCancel: () => undefined,
      });
    }
    const view = await render(createElement(ControlledRecorder));
    const submit = [...view.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Record external submission"),
    )!;
    const describedBy = submit.getAttribute("aria-describedby")!;
    expect(describedBy).toBeTruthy();
    expect(view.ownerDocument.getElementById(describedBy)?.textContent).toContain(
      "Select at least one exact packet format",
    );
    expect(view.querySelector('input[type="checkbox"]')?.getAttribute("aria-describedby")).toBe(
      describedBy,
    );

    const destination = view.querySelector('input[placeholder^="Portal URL"]') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setValue.call(destination, "Candidate-recorded portal");
      destination.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(view.querySelector('[role="alert"]')?.textContent).toContain(
      "Choose at least one exact packet format",
    );
    expect(view.querySelector(".submission-formats")).toBe(document.activeElement);

    const noMaterials = view.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!;
    await act(async () => noMaterials.click());
    expect(view.querySelector(".submission-formats")).toBeNull();
    expect(view.querySelector('[role="alert"]')).toBeNull();
    expect(submit.getAttribute("aria-describedby")).toBeNull();
    await act(async () => submit.click());
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        materialsCaptured: false,
        packetId: null,
        artifactFormats: [],
      }),
    );
  });

  it("renders each answer revision's own context and ordered full evidence IDs", async () => {
    const onCopyEvidence = vi.fn();
    const view = await render(
      createElement(AnswerRevisionHistory, {
        revisions: [
          {
            id: "revision-2",
            revision: 2,
            topic: "why_role",
            prompt: "What made this exact role compelling?",
            answerText: "Candidate-authored revision two.",
            evidenceIds: ["evidence-second-full-id", "evidence-first-full-id"],
            createdAt: "2026-08-31T12:00:00.000Z",
          },
          {
            id: "revision-1",
            revision: 1,
            topic: null,
            prompt: null,
            answerText: "Legacy answer text.",
            evidenceIds: [],
            createdAt: "2026-08-30T12:00:00.000Z",
          },
        ],
        onCopyEvidence,
      }),
    );

    expect(view.textContent).toContain("Why role");
    expect(view.textContent).toContain("What made this exact role compelling?");
    expect(view.textContent).toContain("Legacy provenance limit");
    expect(view.textContent).toContain("does not inherit context from the current Answer Block");
    const evidenceCodes = [
      ...view.querySelectorAll('[aria-label="Evidence order for answer revision 2"] code'),
    ].map((node) => node.textContent);
    expect(evidenceCodes).toEqual(["evidence-second-full-id", "evidence-first-full-id"]);
    await act(async () =>
      (
        view.querySelector(
          '[aria-label="Copy evidence ID evidence-second-full-id"]',
        ) as HTMLButtonElement
      ).click(),
    );
    expect(onCopyEvidence).toHaveBeenCalledWith("evidence-second-full-id", 2);
  });

  it("loads immutable answer history only when the candidate expands it", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "answer-1",
        topic: "why_role",
        prompt: "Why this role?",
        currentRevision: 2,
        nextCursor: null,
        latest: {
          answerText: "Current answer",
          evidenceIds: [],
          createdAt: "2026-09-01T12:00:00.000Z",
        },
        revisions: [
          {
            id: "revision-2",
            revision: 2,
            topic: "why_role",
            prompt: "Why this role?",
            answerText: "Current answer",
            evidenceIds: [],
            createdAt: "2026-09-01T12:00:00.000Z",
          },
          {
            id: "revision-1",
            revision: 1,
            topic: "why_role",
            prompt: "Why this role?",
            answerText: "First answer",
            evidenceIds: [],
            createdAt: "2026-08-31T12:00:00.000Z",
          },
        ],
        createdAt: "2026-08-31T12:00:00.000Z",
        updatedAt: "2026-09-01T12:00:00.000Z",
      }),
    } as Response);
    const view = await render(
      createElement(AnswerHistoryDetails, {
        answer: {
          id: "answer-1",
          topic: "why_role",
          prompt: "Why this role?",
          currentRevision: 2,
          latest: {
            answerText: "Current answer",
            evidenceIds: [],
            createdAt: "2026-09-01T12:00:00.000Z",
          },
          createdAt: "2026-08-31T12:00:00.000Z",
          updatedAt: "2026-09-01T12:00:00.000Z",
        },
        onCopyEvidence: vi.fn(),
      }),
    );

    expect(fetch).not.toHaveBeenCalled();
    const details = view.querySelector("details")!;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/answer-blocks/answer-1/revisions"),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(view.textContent).toContain("Revision 2");
    expect(view.textContent).toContain("First answer");
  });

  it("loads older answer revisions when asked", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "answer-1",
          topic: "why_role",
          prompt: "Why this role?",
          currentRevision: 2,
          nextCursor: "revision-2",
          latest: {
            answerText: "Current answer",
            evidenceIds: [],
            createdAt: "2026-09-01T12:00:00.000Z",
          },
          revisions: [
            {
              id: "revision-2",
              revision: 2,
              topic: "why_role",
              prompt: "Why this role?",
              answerText: "Current answer",
              evidenceIds: [],
              createdAt: "2026-09-01T12:00:00.000Z",
            },
          ],
          createdAt: "2026-08-31T12:00:00.000Z",
          updatedAt: "2026-09-01T12:00:00.000Z",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          currentRevision: 2,
          nextCursor: null,
          revisions: [
            {
              id: "revision-1",
              revision: 1,
              topic: "why_role",
              prompt: "Why this role?",
              answerText: "First answer",
              evidenceIds: [],
              createdAt: "2026-08-31T12:00:00.000Z",
            },
          ],
        }),
      } as Response);
    const view = await render(
      createElement(AnswerHistoryDetails, {
        answer: {
          id: "answer-1",
          topic: "why_role",
          prompt: "Why this role?",
          currentRevision: 2,
          latest: {
            answerText: "Current answer",
            evidenceIds: [],
            createdAt: "2026-09-01T12:00:00.000Z",
          },
          createdAt: "2026-08-31T12:00:00.000Z",
          updatedAt: "2026-09-01T12:00:00.000Z",
        },
        onCopyEvidence: vi.fn(),
      }),
    );

    const details = view.querySelector("details")!;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
      await Promise.resolve();
      await Promise.resolve();
    });

    const loadMore = view.querySelector<HTMLElement>('button[type="button"]')!;
    expect(loadMore.textContent).toContain("Load older revisions");
    await act(async () => {
      await loadMore.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/v1/answer-blocks/answer-1/revisions?cursor=revision-2&limit=20"),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(view.textContent).toContain("First answer");
  });
});

describe("answer history refresh", () => {
  function answerAt(currentRevision: number) {
    return {
      id: "answer-1",
      topic: "why_role" as const,
      prompt: "Why this role?",
      currentRevision,
      latest: {
        answerText: `Answer at revision ${currentRevision}`,
        evidenceIds: [],
        createdAt: "2026-09-01T12:00:00.000Z",
      },
      createdAt: "2026-08-31T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    };
  }

  function serveRevisions(state: { current: number }) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const currentRevision = state.current;
      const record = {
        ...answerAt(currentRevision),
        revisions: Array.from({ length: currentRevision }, (_unused, index) => {
          const revision = currentRevision - index;
          return {
            id: `revision-${revision}`,
            revision,
            topic: "why_role",
            prompt: "Why this role?",
            answerText: `Answer at revision ${revision}`,
            evidenceIds: [],
            createdAt: "2026-09-01T12:00:00.000Z",
          };
        }),
      };
      return { ok: true, json: async () => record } as Response;
    });
  }

  async function openDetails(view: HTMLDivElement) {
    const details = view.querySelector("details")!;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("reloads history when a revision lands while the panel is open", async () => {
    const served = { current: 2 };
    const fetch = serveRevisions(served);
    const view = await render(
      createElement(AnswerHistoryDetails, {
        answer: answerAt(2),
        onCopyEvidence: vi.fn(),
      }),
    );

    expect(fetch).not.toHaveBeenCalled();
    await openDetails(view);
    expect(view.textContent).toContain("Answer at revision 2");
    expect(view.textContent).not.toContain("Answer at revision 3");

    fetch.mockClear();
    served.current = 3;
    await act(async () => {
      root?.render(
        createElement(AnswerHistoryDetails, {
          answer: answerAt(3),
          onCopyEvidence: vi.fn(),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalled();
    expect(view.textContent).toContain("Answer at revision 3");
  });

  it("does not fetch history for a revision that lands while the panel is closed", async () => {
    const served = { current: 2 };
    const fetch = serveRevisions(served);
    await render(
      createElement(AnswerHistoryDetails, {
        answer: answerAt(2),
        onCopyEvidence: vi.fn(),
      }),
    );

    served.current = 3;
    await act(async () => {
      root?.render(
        createElement(AnswerHistoryDetails, {
          answer: answerAt(3),
          onCopyEvidence: vi.fn(),
        }),
      );
      await Promise.resolve();
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Profile Version rebinding", () => {
  const staleBinding = {
    application: {
      id: "application-1",
      jobId: "job-1",
      profileVersionId: "aaaaaaaa-1111-4111-8111-111111111111",
    },
    profile: { id: "bbbbbbbb-2222-4222-8222-222222222222", claimIds: ["evidence-1"] },
    job: { id: "job-1", contentHash: "role-hash" },
    match: null,
    evidence: [],
    busy: false,
  };
  const reason =
    "This Application is bound to Profile Version aaaaaaaa; your current Profile is bbbbbbbb.";

  it("offers the composer a way out of a stale Profile Version binding", async () => {
    const onRebind = vi.fn();
    const view = await render(
      createElement(PacketComposer, {
        ...staleBinding,
        onGenerate: vi.fn(),
        onRebind,
      }),
    );

    expect(view.textContent).toContain(reason);
    const button = view.querySelector<HTMLButtonElement>("button.profile-rebind");
    expect(button?.textContent).toContain("Use current Profile Version");
    await act(async () => button?.click());
    expect(onRebind).toHaveBeenCalledTimes(1);
  });

  it("states the dead end without a control when no rebind is possible", async () => {
    const view = await render(
      createElement(PacketComposer, {
        ...staleBinding,
        profile: null,
        onGenerate: vi.fn(),
        onRebind: vi.fn(),
      }),
    );

    expect(view.textContent).toContain("Save the Application's exact Profile Version first.");
    expect(view.querySelector("button.profile-rebind")).toBeNull();
  });

  it("offers the same sentence and control on the submission recorder", async () => {
    const onRebind = vi.fn();
    const view = await render(
      createElement(ApplicationSubmissionRecorder, {
        packet: null,
        rebindReason: reason,
        draft: createSubmissionDraft(null, new Date("2026-09-01T12:00:00.000Z")),
        busy: false,
        onDraftChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
        onRebind,
      }),
    );

    expect(view.textContent).toContain(reason);
    const button = view.querySelector<HTMLButtonElement>("button.profile-rebind");
    expect(button?.textContent).toContain("Use current Profile Version");
    await act(async () => button?.click());
    expect(onRebind).toHaveBeenCalledTimes(1);
  });
});
