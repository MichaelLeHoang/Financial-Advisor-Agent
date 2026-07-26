"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import type { MemoryCategory, UserMemory } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LoadingRegion, SkeletonBlock, SkeletonText } from "@/components/ui/DataLoading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { showToast } from "@/components/ui/toast";

const CATEGORY_OPTIONS: Array<{ value: MemoryCategory; label: string }> = [
  { value: "investment_horizon", label: "Investment horizon" },
  { value: "risk_preference", label: "Risk preference" },
  { value: "asset_restriction", label: "Asset restriction" },
  { value: "sector_preference", label: "Sector preference" },
  { value: "research_preference", label: "Research preference" },
  { value: "communication_preference", label: "Communication style" },
  { value: "trading_rule", label: "Trading rule" },
];

export function MemoryCandidateCard({
  memory,
  onResolved,
}: {
  memory: UserMemory;
  onResolved: (memoryId: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const resolve = async (action: "confirm" | "reject") => {
    setBusy(true);
    try {
      if (action === "confirm") await api.confirmMemory(memory.id);
      else await api.rejectMemory(memory.id);
      onResolved(memory.id);
      showToast({
        title: action === "confirm" ? "Memory saved" : "Memory dismissed",
        message: action === "confirm" ? "Sabi can use this in future conversations." : "This exact suggestion will not be shown again.",
        variant: action === "confirm" ? "success" : "default",
      });
    } catch (error) {
      showToast({
        title: "Memory was not updated",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-indigo-primary/25 bg-indigo-primary/[0.07] p-3" aria-label="Suggested memory">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-primary/12 text-indigo-primary">
          <Brain className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Remember this?</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{memory.label}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void resolve("confirm")} className="h-8 rounded-lg px-3 text-xs">
              <Check className="size-3.5" /> Save
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void resolve("reject")} className="h-8 rounded-lg px-3 text-xs">
              <X className="size-3.5" /> Dismiss
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AgentMemoryDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<MemoryCategory>("investment_horizon");
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [clearOpen, setClearOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.memories("all");
      setMemories(response.memories.filter((memory) => !["rejected", "superseded"].includes(memory.status)));
      setEnabled(response.settings.enabled);
    } catch (error) {
      showToast({ title: "Memory unavailable", message: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await api.updateMemorySettings(next);
      onChanged?.();
    } catch (error) {
      setEnabled(!next);
      showToast({ title: "Setting was not saved", message: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    }
  };

  const add = async () => {
    const clean = label.trim();
    if (!clean) return;
    try {
      const memory = await api.createMemory({ category, label: clean, value_json: { value: clean } });
      setMemories((current) => [memory, ...current]);
      setLabel("");
      setAdding(false);
      onChanged?.();
    } catch (error) {
      showToast({ title: "Memory was not saved", message: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    }
  };

  const saveEdit = async (memory: UserMemory) => {
    const clean = editingLabel.trim();
    if (!clean) return;
    try {
      const updated = await api.updateMemory(memory.id, { label: clean, value_json: { value: clean } });
      setMemories((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
      onChanged?.();
    } catch (error) {
      showToast({ title: "Memory was not updated", message: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    }
  };

  const remove = async (memoryId: string) => {
    try {
      await api.deleteMemory(memoryId);
      setMemories((current) => current.filter((item) => item.id !== memoryId));
      onChanged?.();
    } catch (error) {
      showToast({ title: "Memory was not deleted", message: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    }
  };

  const clearAll = async () => {
    try {
      await api.clearMemories();
      setMemories([]);
      setClearOpen(false);
      onChanged?.();
    } catch (error) {
      showToast({ title: "Memories were not cleared", message: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    }
  };

  const pending = memories.filter((memory) => memory.status === "candidate");
  const confirmed = memories.filter((memory) => memory.status === "confirmed");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl p-0 sm:w-[min(92vw,680px)]">
          <DialogHeader className="border-b border-[var(--theme-border)] px-5 pb-4 pt-5 pr-14">
            <DialogTitle className="flex items-center gap-2"><Brain className="size-5 text-indigo-primary" />AI Desk memory</DialogTitle>
            <DialogDescription>Sabi uses only memories you approve. Live market and account data always come from their source services.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-4">
              <div><p className="text-sm font-semibold text-[var(--text-primary)]">Use personal memory</p><p className="mt-1 text-xs text-[var(--text-muted)]">Turning this off keeps saved memories but excludes them from answers.</p></div>
              <button type="button" role="switch" aria-checked={enabled} onClick={() => void toggle()} className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-150 motion-reduce:transition-none ${enabled ? "border-indigo-primary bg-indigo-primary" : "border-[var(--theme-border-strong)] bg-[var(--surface-control)]"}`}>
                <span className={`absolute top-1 size-5 rounded-full bg-white transition-transform duration-150 motion-reduce:transition-none ${enabled ? "translate-x-5" : "translate-x-1"}`} />
                <span className="sr-only">{enabled ? "Disable memory" : "Enable memory"}</span>
              </button>
            </div>

            {pending.length > 0 && <section className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Needs your approval</h3>{pending.map((memory) => <MemoryCandidateCard key={memory.id} memory={memory} onResolved={(id) => setMemories((current) => current.filter((item) => item.id !== id))} />)}</section>}

            <section className="space-y-2">
              <div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Saved memories</h3><Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => setAdding((current) => !current)}><Plus className="size-3.5" /> Add</Button></div>
              {adding && <div className="grid gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-3 sm:grid-cols-[180px_1fr_auto]"><select aria-label="Memory category" value={category} onChange={(event) => setCategory(event.target.value as MemoryCategory)} className="h-9 rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-2 text-sm">{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input aria-label="Memory description" value={label} onChange={(event) => setLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void add(); }} placeholder="What should Sabi remember?" className="h-9 rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 text-sm" /><Button size="sm" className="h-9 rounded-lg" disabled={!label.trim()} onClick={() => void add()}>Save</Button></div>}
              <LoadingRegion
                loading={loading}
                label="Loading memories"
                skeleton={(
                  <div className="space-y-1">
                    {Array.from({ length: 3 }, (_, index) => (
                      <div key={index} className="flex items-center gap-3 border-b border-[var(--theme-border)] py-3 last:border-0">
                        <SkeletonText className="min-w-0 flex-1" lines={2} widths={[index === 1 ? "72%" : "86%", "30%"]} />
                        <SkeletonBlock className="size-8 rounded-lg" />
                        <SkeletonBlock className="size-8 rounded-lg" />
                      </div>
                    ))}
                  </div>
                )}
              >
                {confirmed.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--theme-border)] p-5 text-sm text-[var(--text-muted)]">No saved memories yet. Sabi will suggest useful preferences after conversations.</p> : confirmed.map((memory) => <div key={memory.id} className="flex items-start gap-3 border-b border-[var(--theme-border)] py-3 last:border-0"><div className="min-w-0 flex-1">{editingId === memory.id ? <input autoFocus aria-label="Edit memory" value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveEdit(memory); if (event.key === "Escape") setEditingId(null); }} className="h-9 w-full rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 text-sm" /> : <><p className="text-sm text-[var(--text-primary)]">{memory.label}</p><p className="mt-1 text-[11px] capitalize text-[var(--text-subtle)]">{memory.category.replaceAll("_", " ")}</p></>}</div><Button size="icon" variant="ghost" aria-label={editingId === memory.id ? "Save memory" : "Edit memory"} className="size-8" onClick={() => { if (editingId === memory.id) void saveEdit(memory); else { setEditingId(memory.id); setEditingLabel(memory.label); } }}>{editingId === memory.id ? <Check className="size-4" /> : <Pencil className="size-4" />}</Button><Button size="icon" variant="ghost" aria-label="Delete memory" className="size-8 text-[var(--color-red-negative)]" onClick={() => void remove(memory.id)}><Trash2 className="size-4" /></Button></div>)}
              </LoadingRegion>
            </section>

            {memories.length > 0 && <Button variant="outline" className="border-[var(--color-red-negative)]/30 text-[var(--color-red-negative)]" onClick={() => setClearOpen(true)}>Forget everything</Button>}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Forget all saved memories?</AlertDialogTitle><AlertDialogDescription>This permanently removes confirmed and pending memories. Your chat history is not deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep memories</AlertDialogCancel><AlertDialogAction className="bg-[var(--color-red-negative)] text-white" onClick={() => void clearAll()}>Forget everything</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
