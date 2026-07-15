import test from "node:test";
import assert from "node:assert/strict";
import { createPaperTradingPreset } from "../../src/lib/trading/workspacePresets.ts";
import { migrateWorkspace, normalizeWorkspaceWidgets, uid, widgetsOverlap } from "../../src/lib/trading/workspaceSchema.ts";

test("built-in Paper Trading preset has all required widgets", () => { const preset = createPaperTradingPreset("2026-01-01T00:00:00.000Z"); assert.equal(preset.widgets.length, 6); assert.equal(preset.presetType, "paper_trading"); });
test("layout serializes, restores, and migrates old versions", () => { const preset = createPaperTradingPreset(); const restored = migrateWorkspace(JSON.parse(JSON.stringify({ ...preset, layoutVersion: 0 })), preset); assert.equal(restored.layoutVersion, 1); assert.equal(restored.widgets.length, 6); });
test("unknown widget types are ignored and dimensions are clamped", () => { const preset = createPaperTradingPreset(); const input = { ...preset, widgets: [{ ...preset.widgets[0], position: { x: -10, y: -3, width: 99, height: 0 } }, { type: "unknown" }] }; const migrated = migrateWorkspace(input, preset); assert.equal(migrated.widgets.length, 1); assert.deepEqual(migrated.widgets[0].position, { x: 0, y: 0, width: 12, height: 4 }); });
test("generated duplicate ids are unique", () => { assert.notEqual(uid("workspace"), uid("workspace")); });
test("overlapping restored widgets are moved to the next free grid row", () => { const preset = createPaperTradingPreset(); const overlapping = preset.widgets.map((widget, index) => index === 4 ? { ...widget, position: { ...widget.position, x: 2, y: 0 } } : widget); const normalized = normalizeWorkspaceWidgets(overlapping); for (let left = 0; left < normalized.length; left += 1) for (let right = left + 1; right < normalized.length; right += 1) assert.equal(widgetsOverlap(normalized[left], normalized[right]), false); });
