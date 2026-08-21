export type DeletionReceipt = {
  token: string;
  state: "completed" | "cleanup_pending";
  message: string;
};

export type IdentityTransitionEvent =
  | "workspace_opened"
  | "identity_changed"
  | "authentication_required"
  | "session_lost"
  | "signed_out"
  | { kind: "deletion_recorded"; receipt: DeletionReceipt };

export type IdentityTransitionPlan = Readonly<{
  clearCredentials?: true;
  clearDrafts: true;
  clearDashboard?: true;
  requireAuthentication?: true;
  closeMobileNavigation?: true;
  receipt?: "retire_completed" | DeletionReceipt;
}>;

type LocationInput = {
  hash: string;
  rememberBootstrap: (secret: string) => void;
  scrub: () => void;
};

export type LocationDisposition =
  | { kind: "bootstrap"; secret: string }
  | { kind: "invite"; token: string }
  | { kind: "route"; hash: string }
  | { kind: "empty" }
  | { kind: "discarded" };

function scrubCredential(input: LocationInput): void {
  try {
    input.scrub();
  } catch {
    throw new Error("CREDENTIAL_SCRUB_FAILED");
  }
}

/** Security-sensitive browser transitions stay separate from routing. */
export const workspaceIdentityTransitions = {
  consumeLocation(input: LocationInput): LocationDisposition {
    const fragment = new URLSearchParams(input.hash.replace(/^#/u, ""));
    const invitation = fragment.get("invite") ?? "";
    const bootstrap = fragment.get("bootstrap") ?? "";

    // Capture first, scrub second. Invitation takes precedence if a malformed
    // link contains both values, and no returned error ever echoes a secret.
    if (invitation) {
      scrubCredential(input);
      return { kind: "invite", token: invitation };
    }
    if (bootstrap) {
      try {
        input.rememberBootstrap(bootstrap);
      } catch {
        scrubCredential(input);
        throw new Error("CREDENTIAL_STORAGE_UNAVAILABLE");
      }
      scrubCredential(input);
      return { kind: "bootstrap", secret: bootstrap };
    }
    if (input.hash.includes("=")) {
      scrubCredential(input);
      return { kind: "discarded" };
    }
    if (!input.hash) return { kind: "empty" };
    return { kind: "route", hash: input.hash };
  },

  plan(event: IdentityTransitionEvent): IdentityTransitionPlan {
    if (event === "workspace_opened") {
      return {
        clearCredentials: true,
        clearDrafts: true,
        receipt: "retire_completed",
      };
    }
    if (event === "identity_changed") {
      return {
        clearDrafts: true,
        closeMobileNavigation: true,
      };
    }
    if (event === "authentication_required") {
      return {
        clearDrafts: true,
        clearDashboard: true,
        requireAuthentication: true,
        closeMobileNavigation: true,
      };
    }
    if (event === "signed_out") {
      return {
        clearCredentials: true,
        clearDrafts: true,
        clearDashboard: true,
        requireAuthentication: true,
        closeMobileNavigation: true,
      };
    }
    if (event === "session_lost") {
      return {
        clearCredentials: true,
        clearDrafts: true,
        clearDashboard: true,
        requireAuthentication: true,
        closeMobileNavigation: true,
      };
    }
    return { clearDrafts: true, receipt: event.receipt };
  },
};
