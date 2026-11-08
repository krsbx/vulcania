import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { MacOSMetadata } from "../types.ts";
import { Plist } from "./plist/index.ts";

export async function metadataToPlist(
  distPath: string,
  metadata: MacOSMetadata
): Promise<boolean> {
  const outputPath = resolve(
    distPath,
    `${metadata.displayName}.app`,
    "Contents",
    "Info.plist"
  );

  try {
    if (!existsSync(dirname(outputPath))) {
      await mkdir(dirname(outputPath), { recursive: true });
    }

    const plist = new Plist({
      CFBundleExecutable: metadata.name,
      CFBundleIdentifier: metadata.bundleId,
      CFBundleName: metadata.displayName,
      CFBundleDisplayName: metadata.displayName,
      CFBundlePackageType: "APPL",
      CFBundleShortVersionString: metadata.version,
      CFBundleVersion: metadata.version,
      CFBundleIconFile: metadata.icon,
      LSUIElement: false,
      NSHighResolutionCapable: true,
      CFBundleGetInfoString: metadata.description ?? "",
      LSMinimumSystemVersion: metadata.minimumSystemVersion ?? "11.0",
      ...(metadata.category && {
        LSApplicationCategoryType: metadata.category,
      }),
    });

    await writeFile(outputPath, plist.toString());

    return true;
  } catch {
    return false;
  }
}
