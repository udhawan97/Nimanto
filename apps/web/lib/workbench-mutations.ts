export type WorkbenchMutation<T> = Readonly<{
  request: () => Promise<T>;
  success: string | ((value: T) => string);
  commit?: (value: T) => void;
  focus?: (value: T) => void;
  recover?: (error: unknown) => boolean | void;
}>;

export type WorkbenchMutationOutcome<T> =
  | { kind: "committed"; value: T }
  | { kind: "failed" }
  | { kind: "signed_out" }
  | { kind: "unreachable" }
  | { kind: "busy" };

export type RefreshOutcome = "ready" | "signed_out" | "unreachable" | "failed";

export type WorkbenchMutations = {
  run<T>(mutation: WorkbenchMutation<T>): Promise<WorkbenchMutationOutcome<T>>;
};

type MutationAdapters = {
  setBusy: (busy: boolean) => void;
  clearNotice: () => void;
  setNoticeFocus: (focus: boolean) => void;
  setReachable: (reachable: boolean) => void;
  enterSignedOutState: () => void;
  refresh: () => Promise<RefreshOutcome>;
  describeFailure: (error: unknown) => string | null;
  publishNotice: (kind: "ok" | "error", text: string) => void;
  schedule: (work: () => void) => void;
};

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

/** UI-only sequencing. The request stays opaque so this cannot become a domain
 * command bus or absorb Action Intent semantics. */
export function createWorkbenchMutations(adapters: MutationAdapters): WorkbenchMutations {
  let running = false;
  return {
    async run<T>(mutation: WorkbenchMutation<T>): Promise<WorkbenchMutationOutcome<T>> {
      if (running) return { kind: "busy" };
      running = true;
      adapters.setBusy(true);
      adapters.clearNotice();
      adapters.setNoticeFocus(false);
      let committed!: T;
      let settled = false;
      try {
        const value = await mutation.request();
        committed = value;
        mutation.commit?.(value);
        const refreshed = await adapters.refresh();
        // A successful sign-out or deletion intentionally makes reconciliation
        // report signed_out. The request still committed and its outcome must
        // remain visible on the entry screen. Authentication loss thrown by the
        // request itself is handled separately below and publishes no stale
        // success notice.
        if (refreshed === "unreachable" || refreshed === "failed") {
          return { kind: refreshed };
        }
        adapters.publishNotice(
          "ok",
          typeof mutation.success === "function" ? mutation.success(value) : mutation.success,
        );
        settled = true;
        return { kind: "committed", value };
      } catch (error) {
        if (errorCode(error) === "AUTHENTICATION_REQUIRED") {
          adapters.setReachable(true);
          adapters.enterSignedOutState();
          return { kind: "signed_out" };
        }
        if (error instanceof TypeError) {
          adapters.setReachable(false);
          return { kind: "unreachable" };
        }
        const fieldOwnsRecovery = mutation.recover?.(error) === true;
        const text = adapters.describeFailure(error);
        if (text) {
          adapters.setNoticeFocus(!fieldOwnsRecovery);
          adapters.publishNotice("error", text);
        }
        return { kind: "failed" };
      } finally {
        running = false;
        adapters.setBusy(false);
        if (settled && mutation.focus) {
          const value = committed;
          adapters.schedule(() => mutation.focus?.(value));
        }
      }
    },
  };
}
