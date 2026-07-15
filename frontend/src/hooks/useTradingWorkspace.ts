"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createPaperTradingPreset, createWorkspaceFromTemplate, type TradingWorkspaceTemplate } from "@/lib/trading/workspacePresets";
import { clampWidget, migrateWorkspace, normalizeWorkspaceWidgets, uid, widgetsOverlap, WIDGET_MIN_SIZE, type TradingWorkspace, type WorkspaceWidgetInstance, type WorkspaceWidgetType } from "@/lib/trading/workspaceSchema";

export type WorkspaceSaveState = "saved" | "saving" | "unsaved";
type PlacementDelta = { x: number; y: number };

export function useTradingWorkspace() {
  const { user, loading } = useAuth();
  const initialPreset = useMemo(() => createPaperTradingPreset(), []);
  const [workspace, setWorkspace] = useState<TradingWorkspace>(initialPreset);
  const [workspaces, setWorkspaces] = useState<TradingWorkspace[]>([initialPreset]);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<WorkspaceSaveState>("saved");
  const editSnapshot = useRef<TradingWorkspace | null>(null);
  const owner = user.is_guest ? "guest" : `user:${user.id}`;
  const storageKey = `quanfora.trading-workspace.${owner}`;
  const collectionKey = `${storageKey}.collection`;
  const activeKey = `${storageKey}.active`;

  const persistCollection = useCallback((items: TradingWorkspace[], activeId: string) => {
    try {
      window.sessionStorage.setItem(collectionKey, JSON.stringify(items.filter((item) => item.presetType === "custom")));
      window.sessionStorage.setItem(activeKey, activeId);
    } catch {}
  }, [activeKey, collectionKey]);

  useEffect(() => {
    if (loading) return;
    const preset = createPaperTradingPreset();
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(collectionKey) ?? "[]") as unknown;
      const normalizeName = (item: TradingWorkspace) => ({ ...item, name: item.name.replace(/(?: copy){2,}$/i, " copy") });
      const custom = Array.isArray(stored) ? stored.map((item) => normalizeName(migrateWorkspace(item, preset))).filter((item) => item.presetType === "custom") : [];
      const legacy = normalizeName(migrateWorkspace(JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null"), preset));
      if (legacy.presetType === "custom" && !custom.some((item) => item.id === legacy.id)) custom.push(legacy);
      const restoredPreset = legacy.presetType === "paper_trading" ? { ...preset, selectedSymbol: legacy.selectedSymbol } : preset;
      const next = [restoredPreset, ...custom];
      const activeId = window.sessionStorage.getItem(activeKey) ?? legacy.id;
      setWorkspaces(next);
      setWorkspace(next.find((item) => item.id === activeId) ?? restoredPreset);
    } catch {
      setWorkspaces([preset]);
      setWorkspace(preset);
    }
    setSaveState("saved");
  }, [activeKey, collectionKey, loading, storageKey]);

  const update = useCallback((updater: (current: TradingWorkspace) => TradingWorkspace) => {
    setWorkspace((current) => {
      const changed = updater(current);
      const convertingPreset = current.presetType === "paper_trading";
      return {
        ...changed,
        id: convertingPreset ? uid("workspace") : changed.id,
        name: convertingPreset ? "Paper Trading — Custom" : changed.name,
        isDefault: false,
        presetType: "custom",
        basePresetType: "paper_trading",
        updatedAt: new Date().toISOString(),
      };
    });
    setSaveState("unsaved");
  }, []);

  const updateWidget = useCallback((instanceId: string, updater: (widget: WorkspaceWidgetInstance) => WorkspaceWidgetInstance) => update((current) => ({ ...current, widgets: current.widgets.map((widget) => widget.instanceId === instanceId ? clampWidget(updater(widget)) : widget) })), [update]);
  const updateWidgetSafely = useCallback((instanceId: string, updater: (widget: WorkspaceWidgetInstance) => WorkspaceWidgetInstance) => update((current) => {
    const source = current.widgets.find((widget) => widget.instanceId === instanceId); if (!source) return current;
    const candidate = clampWidget(updater(source));
    if (current.widgets.some((widget) => widget.instanceId !== instanceId && widgetsOverlap(candidate, widget))) return current;
    return { ...current, widgets: current.widgets.map((widget) => widget.instanceId === instanceId ? candidate : widget) };
  }), [update]);

  const resolvePlacement = useCallback((instanceId: string, dx: number, dy: number, dw = 0, dh = 0): PlacementDelta | null => {
    const source = workspace.widgets.find((widget) => widget.instanceId === instanceId); if (!source) return null;
    const candidate = clampWidget({ ...source, position: { ...source.position, x: source.position.x + dx, y: source.position.y + dy, width: source.position.width + dw, height: source.position.height + dh } });
    if (workspace.widgets.some((widget) => widget.instanceId !== instanceId && widgetsOverlap(candidate, widget))) return null;
    return dw || dh ? { x: candidate.position.width - source.position.width, y: candidate.position.height - source.position.height } : { x: candidate.position.x - source.position.x, y: candidate.position.y - source.position.y };
  }, [workspace.widgets]);

  const enterEdit = useCallback(() => { editSnapshot.current = structuredClone(workspace); setIsEditing(true); }, [workspace]);
  const cancelEdit = useCallback(() => { if (editSnapshot.current) setWorkspace(editSnapshot.current); editSnapshot.current = null; setIsEditing(false); setSaveState("saved"); }, []);
  const save = useCallback(async () => {
    setSaveState("saving");
    const next = { ...workspace, widgets: normalizeWorkspaceWidgets(workspace.widgets), updatedAt: new Date().toISOString() };
    const nextCollection = [createPaperTradingPreset(), ...workspaces.filter((item) => item.presetType === "custom" && item.id !== next.id), next];
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      persistCollection(nextCollection, next.id);
      setWorkspace(next); setWorkspaces(nextCollection); setSaveState("saved"); setIsEditing(false); editSnapshot.current = null;
    } catch { setSaveState("unsaved"); }
  }, [persistCollection, storageKey, workspace, workspaces]);
  const reset = useCallback(() => { setWorkspace(createPaperTradingPreset()); setSaveState("unsaved"); }, []);
  const duplicateWorkspace = useCallback(() => {
    const baseName = workspace.name.replace(/ copy(?: \d+)?$/i, "");
    const copies = workspaces.filter((item) => item.name === `${baseName} copy` || item.name.startsWith(`${baseName} copy `)).length;
    const copy = { ...structuredClone(workspace), id: uid("workspace"), name: `${baseName} copy${copies ? ` ${copies + 1}` : ""}`, isDefault: false, presetType: "custom" as const, basePresetType: "paper_trading" as const, widgets: workspace.widgets.map((widget) => ({ ...widget, instanceId: uid(widget.type) })), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const next = [...workspaces.filter((item) => item.id !== copy.id), copy];
    setWorkspaces(next); setWorkspace(copy); setSaveState("unsaved"); persistCollection(next, copy.id);
  }, [persistCollection, workspace, workspaces]);
  const createWorkspace = useCallback((template: TradingWorkspaceTemplate) => {
    const generated = createWorkspaceFromTemplate(template);
    const replacingBlank = workspace.presetType === "custom" && workspace.widgets.length === 0;
    const created = replacingBlank && generated.presetType === "custom" ? { ...generated, id: workspace.id, createdAt: workspace.createdAt } : generated;
    if (created.presetType === "paper_trading") {
      const next = replacingBlank ? workspaces.filter((item) => item.id !== workspace.id) : workspaces;
      setWorkspaces(next); setWorkspace(created); persistCollection(next, created.id);
    } else {
      const next = replacingBlank ? workspaces.map((item) => item.id === workspace.id ? created : item) : [...workspaces, created];
      setWorkspaces(next); setWorkspace(created); persistCollection(next, created.id);
    }
    setSaveState(created.presetType === "paper_trading" ? "saved" : "unsaved");
  }, [persistCollection, workspace, workspaces]);
  const createEmptyWorkspace = useCallback(() => {
    const existingNames = new Set(workspaces.map((item) => item.name));
    let name = "Untitled trading workspace";
    let suffix = 2;
    while (existingNames.has(name)) { name = `Untitled trading workspace ${suffix}`; suffix += 1; }
    const now = new Date().toISOString();
    const created: TradingWorkspace = { id: uid("workspace"), name, presetType: "custom", basePresetType: "paper_trading", isDefault: false, layoutVersion: 1, selectedSymbol: workspace.selectedSymbol, widgets: [], createdAt: now, updatedAt: now };
    const next = [...workspaces, created];
    setWorkspaces(next); setWorkspace(created); setSaveState("saved"); setIsEditing(false); persistCollection(next, created.id);
  }, [persistCollection, workspace.selectedSymbol, workspaces]);
  const deleteWorkspace = useCallback(() => {
    if (workspace.presetType !== "custom") return;
    const next = workspaces.filter((item) => item.id !== workspace.id);
    const fallback = next.find((item) => item.presetType === "paper_trading") ?? createPaperTradingPreset();
    setWorkspaces(next.some((item) => item.id === fallback.id) ? next : [fallback, ...next]);
    setWorkspace(fallback); setSaveState("saved"); setIsEditing(false); editSnapshot.current = null;
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(fallback)); } catch {}
    persistCollection(next, fallback.id);
  }, [persistCollection, storageKey, workspace, workspaces]);
  const selectWorkspace = useCallback((id: string) => {
    const selected = workspaces.find((item) => item.id === id); if (!selected) return;
    setWorkspace(selected.presetType === "paper_trading" ? createPaperTradingPreset() : selected); setSaveState("saved"); setIsEditing(false); persistCollection(workspaces, id);
  }, [persistCollection, workspaces]);
  const addWidget = useCallback((type: WorkspaceWidgetType) => update((current) => { const minimum = WIDGET_MIN_SIZE[type]; return { ...current, widgets: [...current.widgets, { instanceId: uid(type), type, position: { x: 0, y: Math.max(12, ...current.widgets.map((widget) => widget.position.y + widget.position.height)), width: type === "price_chart" || type === "trading_activity" || type === "options_chain" ? 7 : Math.max(3, minimum.width), height: type === "price_chart" || type === "options_chain" ? 7 : Math.max(4, minimum.height) }, settings: {}, linkedToWorkspaceSymbol: type !== "account", isVisible: true }] }; }), [update]);
  const hiddenTypes = useMemo(() => new Set(workspace.widgets.filter((widget) => !widget.isVisible).map((widget) => widget.type)), [workspace.widgets]);

  return {
    workspace, workspaces, selectWorkspace, createWorkspace, createEmptyWorkspace, deleteWorkspace,
    setSelectedSymbol: (selectedSymbol: string) => setWorkspace((current) => { const next = { ...current, selectedSymbol, updatedAt: new Date().toISOString() }; try { window.sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch {} return next; }),
    isEditing, saveState, enterEdit, cancelEdit, save, reset, duplicateWorkspace, addWidget, hiddenTypes, resolvePlacement,
    hideWidget: (id: string) => updateWidget(id, (widget) => ({ ...widget, isVisible: false })),
    restoreWidget: (type: WorkspaceWidgetType) => update((current) => ({ ...current, widgets: normalizeWorkspaceWidgets(current.widgets.map((widget) => widget.type === type ? { ...widget, isVisible: true } : widget)) })),
    duplicateWidget: (id: string) => update((current) => { const source = current.widgets.find((widget) => widget.instanceId === id); const bottom = Math.max(0, ...current.widgets.map((widget) => widget.position.y + widget.position.height)); return source ? { ...current, widgets: [...current.widgets, { ...source, instanceId: uid(source.type), position: { ...source.position, x: 0, y: bottom } }] } : current; }),
    moveWidget: (id: string, dx: number, dy: number) => updateWidgetSafely(id, (widget) => ({ ...widget, position: { ...widget.position, x: widget.position.x + dx, y: widget.position.y + dy } })),
    resizeWidget: (id: string, dw: number, dh: number) => updateWidgetSafely(id, (widget) => ({ ...widget, position: { ...widget.position, width: widget.position.width + dw, height: widget.position.height + dh } })),
    setWidgetSetting: (id: string, key: string, value: unknown) => updateWidget(id, (widget) => ({ ...widget, settings: { ...widget.settings, [key]: value } })),
    setWidgetLinked: (id: string, linked: boolean) => updateWidget(id, (widget) => ({ ...widget, linkedToWorkspaceSymbol: linked })),
  };
}
