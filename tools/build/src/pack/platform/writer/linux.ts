import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { LinuxMetadata } from "../../types.ts";
import { toDesktopEntry } from "../config/index.ts";

export async function writeDesktopFile(
  distPath: string,
  metadata: LinuxMetadata
): Promise<void> {
  const outputPath = resolve(distPath, `${metadata.name}.desktop`);

  if (!existsSync(dirname(outputPath))) {
    await mkdir(dirname(outputPath), { recursive: true });
  }

  await writeFile(outputPath, toDesktopEntry(metadata));
}
