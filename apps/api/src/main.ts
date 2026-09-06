import { loadOptions } from "./config.js";
import { buildServer } from "./server.js";

const options = loadOptions();
const app = await buildServer(options);

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: options.host, port: options.port });
console.log(`Nimanto API ready at http://${options.host}:${options.port}`);
if (options.demoMode) {
  const workspace = new URL("/workspace/", options.webOrigin).toString();
  if (options.bootstrapSecretGenerated) {
    // A freshly generated local secret: print the one-click link so the
    // launcher flow works. The URL follows the configured web origin.
    console.log(`Open the private workspace at ${workspace}#bootstrap=${options.bootstrapSecret}`);
  } else {
    // The operator supplied the secret through the environment; do not echo it
    // back into stdout, logs, or a supervisor's capture. Point at the workspace.
    console.log(
      `Open the private workspace at ${workspace} and append #bootstrap=<your NIMANTO_BOOTSTRAP_SECRET>.`,
    );
  }
} else {
  console.log("Public signup is disabled. Issue a private invitation through the local admin API.");
}
