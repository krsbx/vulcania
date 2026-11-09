import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { MacOSMetadata } from "../../types.ts";
import { toPlistEntry } from "../config/index.ts";

export async function writePlistFile(
  distPath: string,
  metadata: MacOSMetadata
): Promise<void> {
  const outputPath = resolve(
    distPath,
    `${metadata.displayName}.app`,
    "Contents",
    "Info.plist"
  );

  if (!existsSync(dirname(outputPath))) {
    await mkdir(dirname(outputPath), { recursive: true });
  }

  await writeFile(outputPath, toPlistEntry(metadata));
}
