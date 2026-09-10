// This command intentionally accepts no paths or runtime environment settings.
// The implementation creates and removes only its own synthetic temporary tree.
if (process.argv.length !== 2) {
  console.error("Usage: pnpm recovery:drill (no arguments; synthetic data only)");
  process.exitCode = 2;
} else {
  try {
    const { runRecoveryDrill } = await import("../apps/api/dist/recovery-drill.js");
    console.log(JSON.stringify(await runRecoveryDrill(), null, 2));
  } catch {
    console.error("RECOVERY_DRILL_FAILED: run the recovery-drill API test for failure details.");
    process.exitCode = 1;
  }
}
