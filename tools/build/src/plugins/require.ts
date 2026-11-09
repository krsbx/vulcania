import type { TsdownPlugin } from "tsdown";

const id = "virtual:create-require";

const createRequirePattern =
  /const\s+(\w+)\s*=\s*createRequire\(\s*import\.meta\.url\s*\);?/;

export const createRequirePlugin: TsdownPlugin = {
  name: "create-require",

  transform(code, id) {
    if (id.includes("/node_modules/")) return null;

    const alias = createRequirePattern.exec(code)?.[1];

    if (!alias) return null;

    const contents = code
      .replace(createRequirePattern, "")
      .replace(new RegExp(`\\b${alias}\\(`, "g"), "require(");

    return {
      code: contents,
      map: null,
    };
  },
};
