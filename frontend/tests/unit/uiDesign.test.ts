import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_RADIUS } from "../../src/lib/ui-design.ts";

test("defines one semantic radius for each UI hierarchy level", () => {
  assert.deepEqual(APP_RADIUS, {
    surface: "rounded-2xl",
    nested: "rounded-xl",
    control: "rounded-lg",
    overlay: "rounded-3xl",
    pill: "rounded-full",
  });
});

test("shared primary-surface primitives consume the surface radius", () => {
  const card = readFileSync(new URL("../../src/components/ui/card.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../../src/components/workspace/WorkspaceUI.tsx", import.meta.url), "utf8");

  assert.match(card, /APP_RADIUS\.surface/);
  assert.match(workspace, /APP_RADIUS\.surface/);
  assert.doesNotMatch(workspace, /export function Panel[\s\S]*?rounded-lg/);
});

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectTsxFiles(path);
    }

    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("Card and Panel consumers do not override the shared surface radius", () => {
  const sourceRoots = [
    fileURLToPath(new URL("../../src/app/", import.meta.url)),
    fileURLToPath(new URL("../../src/components/", import.meta.url)),
  ];
  const violations = sourceRoots.flatMap(collectTsxFiles).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    const match = source.match(/<(?:Card|Panel)\b[^>]*\brounded-(?:none|sm|md|lg|xl|3xl|full)\b/g);

    return match?.map((value) => `${path}: ${value.replace(/\s+/g, " ")}`) ?? [];
  });

  assert.deepEqual(violations, []);
});
