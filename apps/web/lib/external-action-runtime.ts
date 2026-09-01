export type ExternalActionRuntime = {
  operatorEnabled: boolean;
  tenantReady: boolean;
  externalActionsEnabled: boolean;
};

export type ExternalActionRuntimeView = {
  effectiveEnabled: boolean;
  nextTenantReady: boolean;
  statusLabel: "Execution runtime is on" | "Execution runtime is off";
  toggleLabel: "Turn workspace opt-in on" | "Turn workspace opt-in off";
  explanation: string;
};

/** Keep the candidate-facing runtime fail-closed even if a malformed response
 * claims effective execution while either independent gate is off. */
export function deriveExternalActionRuntimeView(
  runtime: ExternalActionRuntime,
): ExternalActionRuntimeView {
  const effectiveEnabled =
    runtime.operatorEnabled && runtime.tenantReady && runtime.externalActionsEnabled;
  const explanation = !runtime.operatorEnabled
    ? `Execution is unavailable because this service's operator ceiling is off. Your workspace opt-in is ${runtime.tenantReady ? "on and can still be turned off" : "off"}.`
    : !runtime.tenantReady
      ? "The operator ceiling permits execution, but this workspace's opt-in is off."
      : !runtime.externalActionsEnabled
        ? "Both gates are on, but the service still reports execution unavailable. Do not execute; refresh the runtime state."
        : "The operator ceiling and workspace opt-in are on. Every action still requires exact approval.";
  return {
    effectiveEnabled,
    nextTenantReady: !runtime.tenantReady,
    statusLabel: effectiveEnabled ? "Execution runtime is on" : "Execution runtime is off",
    toggleLabel: runtime.tenantReady ? "Turn workspace opt-in off" : "Turn workspace opt-in on",
    explanation,
  };
}
