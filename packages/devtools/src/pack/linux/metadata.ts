import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { LinuxMetadata } from "../types.ts";
import { Toml } from "./toml/index.ts";

export async function metadataToDesktop(
  distPath: string,
  metadata: LinuxMetadata
): Promise<boolean> {
  const outputPath = resolve(distPath, `${metadata.name}.desktop`);

  try {
    if (!existsSync(dirname(outputPath))) {
      await mkdir(dirname(outputPath), { recursive: true });
    }

    let desktop = "[Desktop Entry]\n";

    let categories = metadata.categories?.join?.(";") ?? "Utility;Development;";

    if (!categories.endsWith(";")) {
      categories += ";";
    }

    const toml = new Toml({
      Type: "Application",
      Name: metadata.displayName,
      Comment: metadata.description ?? "",
      Exec: `./${metadata.name}`,
      Icon: metadata.icon,
      Terminal: false,
      Categories: categories,
      GenericName: metadata.genericName ?? metadata.displayName,
      StartupNotify: true,
      StartupWMClass: metadata.name,
      "X-AppImage-Id": metadata.bundleId,
    });

    desktop += toml;

    await writeFile(outputPath, desktop);

    return true;
  } catch {
    return false;
  }
}
