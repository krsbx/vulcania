import type { TsdownPlugin } from "tsdown";

/**
 * Virtual entry: ESM evaluates imports in order, so inject.ts (library
 * path env vars) runs before anything in the app's module graph.
 */
export function virtualEntryPlugin(
  entryId: string,
  paths: string[]
): TsdownPlugin {
  // `entryId` must not be a real path: the virtual module imports the real
  // entry, which would otherwise resolve back to itself.

  // `\0` marks the id as virtual so other plugins and the resolver leave it be.
  const resolvedEntryId = `\0${entryId}`;

  return {
    name: "virtual-entry",
    resolveId(source) {
      return source === entryId ? resolvedEntryId : null;
    },
    load(id) {
      if (id !== resolvedEntryId) return null;

      return paths.map((path) => `import ${JSON.stringify(path)};`).join("\n");
    },
  };
}
