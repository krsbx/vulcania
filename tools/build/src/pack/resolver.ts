import {
  Library,
  LibraryExtension,
  LibraryPathResolution,
  Platform,
} from "./enums.ts";

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

/**
 * Complete dylib filenames as shipped by the release archives, pinned to
 * `version.lock` (SDL3 3.4.18, image 3.4.8, ttf 3.2.2, mixer 3.2.4,
 * shadercross 1ff05be). macOS names are the built install names
 * (compat-version suffixed); Linux names are the SONAME symlinks the CI
 * re-creates next to the real versioned files; Windows are bare DLLs. A
 * version bump that changes a dylib's compat version MUST update this
 * table.
 */
const LIBRARY_FILE_NAMES: Record<Platform, Record<Library, string>> = {
  [Platform.MacOS]: {
    [Library.SDL3]: "libSDL3.0.dylib",
    [Library.SDL3Image]: "libSDL3_image.0.4.8.dylib",
    [Library.SDL3Mixer]: "libSDL3_mixer.0.2.4.dylib",
    [Library.SDL3Ttf]: "libSDL3_ttf.0.2.2.dylib",
    [Library.SDL3Shadercross]: "libSDL3_shadercross.dylib",
  },
  [Platform.Linux]: {
    [Library.SDL3]: "libSDL3.so.0",
    [Library.SDL3Image]: "libSDL3_image.so.0",
    [Library.SDL3Mixer]: "libSDL3_mixer.so.0",
    [Library.SDL3Ttf]: "libSDL3_ttf.so.0",
    [Library.SDL3Shadercross]: "libSDL3_shadercross.so.0",
  },
  [Platform.Windows]: {
    [Library.SDL3]: "SDL3.dll",
    [Library.SDL3Image]: "SDL3_image.dll",
    [Library.SDL3Mixer]: "SDL3_mixer.dll",
    [Library.SDL3Ttf]: "SDL3_ttf.dll",
    [Library.SDL3Shadercross]: "SDL3_shadercross.dll",
  },
};

export function resolveLibraryFileName(
  library: Library,
  platform: Platform = resolvePlatform()
): string {
  const resolved = LIBRARY_FILE_NAMES[platform][library];

  if (!resolved) {
    throw new Error(`Unsupported platform: ${platform}!`);
  }

  return resolved;
}
