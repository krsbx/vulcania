import { LibraryExtension, LibraryPathResolution, Platform } from "./enums.ts";

export function resolvePlatform(): Platform {
  switch (process.platform) {
    case "win32":
      return Platform.Windows;

    case "darwin":
      return Platform.MacOS;

    case "linux":
      return Platform.Linux;

    default:
      throw new Error(`Unsupported platform: ${process.platform}!`);
  }
}

export function resolveLibraryPath(
  platform: Platform = resolvePlatform()
): LibraryPathResolution {
  switch (platform) {
    case Platform.Windows:
      return LibraryPathResolution.Windows;

    case Platform.Linux:
      return LibraryPathResolution.Linux;

    case Platform.MacOS:
      return LibraryPathResolution.MacOS;

    default:
      throw new Error(`Unsupported platform: ${platform}!`);
  }
}

export function resolveLibraryExtension(
  platform: Platform = resolvePlatform()
): LibraryExtension {
  switch (platform) {
    case Platform.Windows:
      return LibraryExtension.Windows;

    case Platform.Linux:
      return LibraryExtension.Linux;

    case Platform.MacOS:
      return LibraryExtension.MacOS;

    default:
      throw new Error(`Unsupported platform: ${platform}!`);
  }
}
