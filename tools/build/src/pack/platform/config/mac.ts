import type { MacOSMetadata } from "../../types.ts";
import { Plist } from "./plist/index.ts";

export function toPlistEntry(metadata: MacOSMetadata): string {
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

  return plist.toString();
}
