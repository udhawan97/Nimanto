import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const [outputPath, ...artifactPaths] = process.argv.slice(2);
if (!outputPath || artifactPaths.length === 0) {
  throw new Error("Pass a checksum output path followed by at least one artifact path.");
}

const lines = [];
for (const artifactPath of artifactPaths) {
  const digest = createHash("sha256")
    .update(await readFile(artifactPath))
    .digest("hex");
  lines.push(`${digest}  ${basename(artifactPath)}`);
}

await writeFile(outputPath, `${lines.join("\n")}\n`, { mode: 0o644 });
console.log(`Wrote SHA-256 checksums for ${artifactPaths.length} release artifact(s).`);
