// Auto inject library paths — resolved relative to the executable so a
// packed app finds its dylibs wherever the ffi folder is installed
// next to it. Filenames come from the per-platform table in the
// resolver (pinned to version.lock — update it on a dylib bump).
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { Library } from "../enums.ts";
import { resolveLibraryFileName, resolveLibraryPath } from "../resolver.ts";

const LIBRARY_ENV: Record<Library, string> = {
  [Library.SDL3]: "VULCANIA_SDL3_PATH",
  [Library.SDL3Image]: "VULCANIA_SDL3_IMAGE_PATH",
  [Library.SDL3Mixer]: "VULCANIA_SDL3_MIXER_PATH",
  [Library.SDL3Ttf]: "VULCANIA_SDL3_TTF_PATH",
  [Library.SDL3Shadercross]: "VULCANIA_SDL3_SHADERCROSS_PATH",
};

function resolveLoadPath(library: Library): string {
  return resolve(
    realpathSync(process.execPath),
    resolveLibraryPath(),
    resolveLibraryFileName(library)
  );
}

for (const library of Object.values(Library)) {
  process.env[LIBRARY_ENV[library]] = resolveLoadPath(library);
}
