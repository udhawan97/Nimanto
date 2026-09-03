import type { ApplicationStatus } from "./types.js";

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "tracked",
  "prepared",
  "approved_for_export",
  "submitted_externally",
  "withdrawn",
];

const legalCandidateTargets: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  tracked: ["prepared", "withdrawn"],
  prepared: ["tracked", "approved_for_export", "withdrawn"],
  approved_for_export: ["prepared", "submitted_externally", "withdrawn"],
  submitted_externally: ["approved_for_export", "withdrawn"],
  withdrawn: ["tracked"],
};

const consequentialTargets: readonly ApplicationStatus[] = [
  "approved_for_export",
  "submitted_externally",
  "withdrawn",
];

export type CandidateApplicationOption = Readonly<{
  to: ApplicationStatus;
  confirmation: "none" | "required";
}>;

export type CandidateApplicationDecision =
  | { kind: "unchanged"; status: ApplicationStatus }
  | { kind: "allowed"; transition: { to: ApplicationStatus } }
  | { kind: "confirmation_required"; to: ApplicationStatus }
  | { kind: "illegal"; code: "INVALID_APPLICATION_TRANSITION" };

export type PacketApplicationEffect = "packet_generated" | "packet_approved" | "profile_rebound";

export type PacketApplicationDecision =
  | { kind: "system_consequence"; to: "prepared" | "approved_for_export" }
  | {
      kind: "candidate_status_preserved";
      status: "submitted_externally" | "withdrawn";
    }
  | { kind: "unchanged"; status: ApplicationStatus };

function isStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

function confirmationFor(to: ApplicationStatus): CandidateApplicationOption["confirmation"] {
  return consequentialTargets.includes(to) ? "required" : "none";
}

/**
 * One policy interface for Application status intent. Candidate moves follow
 * the legal board graph and require explicit confirmation for consequential
 * facts. Packet lifecycle writes remain named system consequences; they do not
 * pretend to be candidate moves and never erase a candidate-recorded external
 * submission or withdrawal.
 *
 * Tenant locking and submitted-at stamping deliberately stay in persistence.
 */
export const applicationTransitions = {
  isStatus,

  candidate(from: ApplicationStatus) {
    const options: readonly CandidateApplicationOption[] = isStatus(from)
      ? legalCandidateTargets[from].map((to) => ({ to, confirmation: confirmationFor(to) }))
      : [];

    return {
      options,
      decide(
        to: ApplicationStatus,
        confirmation?: { confirmed: true },
      ): CandidateApplicationDecision {
        if (!isStatus(from) || !isStatus(to)) {
          return { kind: "illegal", code: "INVALID_APPLICATION_TRANSITION" };
        }
        if (from === to) return { kind: "unchanged", status: from };
        if (!legalCandidateTargets[from].includes(to)) {
          return { kind: "illegal", code: "INVALID_APPLICATION_TRANSITION" };
        }
        if (confirmationFor(to) === "required" && !confirmation?.confirmed) {
          return { kind: "confirmation_required", to };
        }
        return { kind: "allowed", transition: { to } };
      },
    };
  },

  packet(from: ApplicationStatus, effect: PacketApplicationEffect): PacketApplicationDecision {
    if (!isStatus(from)) throw new Error("INVALID_PACKET_APPLICATION_STATUS");
    if (
      effect !== "packet_generated" &&
      effect !== "packet_approved" &&
      effect !== "profile_rebound"
    ) {
      throw new Error("INVALID_PACKET_APPLICATION_EFFECT");
    }
    if (from === "submitted_externally" || from === "withdrawn") {
      return { kind: "candidate_status_preserved", status: from };
    }
    /* Rebinding an Application to the current Profile Version retires an
     * approved packet, so an Application that was approved for export goes back
     * to prepared. Nothing else moves. */
    if (effect === "profile_rebound") {
      return from === "approved_for_export"
        ? { kind: "system_consequence", to: "prepared" }
        : { kind: "unchanged", status: from };
    }
    return {
      kind: "system_consequence" as const,
      to: effect === "packet_generated" ? ("prepared" as const) : ("approved_for_export" as const),
    };
  },
};
