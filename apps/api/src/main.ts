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
  console.log(
    `Open the private workspace at http://127.0.0.1:4300/workspace/#bootstrap=${options.bootstrapSecret}`,
  );
} else {
  console.log("Public signup is disabled. Issue a private invitation through the local admin API.");
}
