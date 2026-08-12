"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  ChevronRight,
  FlaskConical,
  History,
  Layers3,
  Plus,
  Redo2,
  Rocket,
  Save,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useStrategyStudio } from "@/components/strategy-studio/StrategyStudioProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import { backtestHref, moveNode, proposalFor, removeNode, updateNode, validateStrategy } from "@/components/strategy-studio/model";
import type { StrategyDraft, StrategyNode, StrategyNodeType } from "@/components/strategy-studio/types";
import { Status } from "@/components/workspace/WorkspaceUI";
import { APP_RADIUS } from "@/lib/ui-design";
import { cn } from "@/lib/utils";

const NODE_TYPES: StrategyNodeType[] = ["universe", "asset", "group", "condition", "filter", "rank", "select", "weight", "entry", "exit", "risk", "schedule"];
type MobilePanel = "architect" | "tree" | "preview";
type ResultTab = "overview" | "backtest" | "validation" | "journal";

export default function StrategyStudioPage({ strategyId }: { strategyId: string }) {
  const { user } = useAuth();
  const { state, updateStrategy, saveVersion, deployPaper } = useStrategyStudio();
  const draft = state.drafts.find((item) => item.id === strategyId);
  const [nodes, setNodes] = useState<StrategyNode[]>(draft?.nodes ?? []);
  const [undoStack, setUndoStack] = useState<StrategyNode[][]>([]);
  const [redoStack, setRedoStack] = useState<StrategyNode[][]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newNodeType, setNewNodeType] = useState<StrategyNodeType>("condition");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("tree");
  const [resultTab, setResultTab] = useState<ResultTab>("overview");
  const [showValidation, setShowValidation] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [proposalAccepted, setProposalAccepted] = useState(false);
  const [proposalDismissed, setProposalDismissed] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setNodes(draft.nodes);
    setUndoStack([]);
    setRedoStack([]);
    setProposalAccepted(false);
    setProposalDismissed(false);
  }, [draft?.id]);

  const workingDraft = useMemo(() => draft ? { ...draft, nodes } : null, [draft, nodes]);
  const issues = useMemo(() => workingDraft ? validateStrategy(workingDraft) : [], [workingDraft]);
  const errors = issues.filter((issue) => issue.severity === "error");
  const selectedNode = findNode(nodes, selectedNodeId);

  if ({ free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 }[user.plan] < 2) {
    return <LockedFeature title="Strategy Studio is available on Trader" description="Build inspectable strategy definitions and review every change before deterministic testing." requiredPlan="trader" benefits={["Nested strategy rules", "Version history", "Paper deployment review"]} />;
  }

  if (!draft || !workingDraft) {
    return <div className="flex min-h-full items-center justify-center p-6"><div className="max-w-md border border-[var(--theme-border)] bg-[var(--surface-card)] p-7 text-center"><Layers3 className="mx-auto size-5 text-[var(--text-subtle)]" /><h1 className="mt-5 text-xl font-semibold">Strategy not found</h1><Link href="/trade/strategies" className="mt-5 inline-flex h-10 items-center bg-white px-4 text-sm font-semibold text-black">Return to strategies</Link></div></div>;
  }

  const basePath = draft.mode === "investment" ? "/invest/strategies" : "/trade/strategies";
  const proposal = proposalFor(workingDraft);

  const commitNodes = (next: StrategyNode[]) => {
    setUndoStack((current) => [...current.slice(-19), structuredClone(nodes)]);
    setRedoStack([]);
    setNodes(next);
    updateStrategy(draft.id, (current) => ({ ...current, nodes: next }));
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((current) => [structuredClone(nodes), ...current].slice(0, 20));
    setUndoStack((current) => current.slice(0, -1));
    setNodes(previous);
    updateStrategy(draft.id, (current) => ({ ...current, nodes: previous }));
  };

  const redo = () => {
    const next = redoStack[0];
    if (!next) return;
    setUndoStack((current) => [...current, structuredClone(nodes)].slice(-20));
    setRedoStack((current) => current.slice(1));
    setNodes(next);
    updateStrategy(draft.id, (current) => ({ ...current, nodes: next }));
  };

  const addNode = () => {
    const id = `${newNodeType}-${Date.now()}`;
    const nextNode: StrategyNode = { id, type: newNodeType, label: titleCase(newNodeType), detail: "New rule awaiting review", parameters: {}, children: [] };
    commitNodes([...nodes, nextNode]);
    setSelectedNodeId(id);
  };

  const validate = () => {
    setShowValidation(true);
    setResultTab("validation");
    setMobilePanel("preview");
  };

  const save = () => {
    setShowValidation(true);
    if (errors.length > 0) {
      setResultTab("validation");
      setMobilePanel("preview");
      return;
    }
    saveVersion(draft.id, nodes);
    setResultTab("journal");
  };

  const requestDeploy = () => {
    setShowValidation(true);
    if (errors.length > 0 || draft.versions.length === 0) {
      setResultTab("validation");
      setMobilePanel("preview");
      return;
    }
    setDeployOpen(true);
  };

  return (
    <div className="min-h-full bg-[var(--theme-bg)] px-3 pb-4 pt-16 text-[var(--text-primary)] sm:px-4 md:pt-4 lg:px-5">
      <div className={cn(APP_RADIUS.surface, "mx-auto max-w-[1800px] overflow-hidden border border-[var(--theme-border)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]")}>
      <header className="border-b border-[var(--theme-border)] bg-[var(--surface-header)] px-4 py-3 lg:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button render={<Link href={basePath} aria-label="Back to strategies" title="Back to strategies" />} nativeButton={false} variant="outline" size="icon"><ArrowLeft className="size-4" /></Button>
          <input aria-label="Strategy name" value={draft.name} onChange={(event) => updateStrategy(draft.id, (current) => ({ ...current, name: event.target.value }))} className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base font-semibold outline-none transition-[background-color,box-shadow] duration-150 hover:bg-[var(--surface-card-hover)] focus-visible:bg-[var(--surface-control)] focus-visible:ring-2 focus-visible:ring-indigo-primary/45 motion-reduce:transition-none sm:min-w-64" />
          <span className="text-xs text-[var(--text-muted)]">{draft.mode === "investment" ? "Investment" : "Trading"} · Draft v{draft.versions.length + 1}</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <IconButton label="Undo" disabled={undoStack.length === 0} onClick={undo}><Undo2 className="size-4" /></IconButton>
            <IconButton label="Redo" disabled={redoStack.length === 0} onClick={redo}><Redo2 className="size-4" /></IconButton>
            <Button type="button" onClick={validate} variant="outline" size="sm"><ShieldCheck className="size-4" /> Validate</Button>
            <Button type="button" onClick={save} variant="outline" size="sm"><Save className="size-4" /> Save version</Button>
            <Button type="button" onClick={requestDeploy} size="sm" className="theme-solid-action"><Rocket className="size-4" /> Paper deploy</Button>
          </div>
        </div>
      </header>

      <div className="border-b border-[var(--theme-border)] bg-[var(--surface-header)] px-4 py-3 xl:hidden">
        <StudioTabList tabs={["architect", "tree", "preview"]} current={mobilePanel} onSelect={setMobilePanel} label="Studio panels" idPrefix="studio-tab" panelId={(tab) => `studio-panel-${tab}`} className="grid w-full grid-cols-3" />
      </div>

      <main className="grid min-h-[680px] bg-[var(--surface-sidebar)] xl:grid-cols-[270px_minmax(360px,1fr)_340px]">
        <section id="studio-panel-architect" role="tabpanel" aria-labelledby="studio-tab-architect" aria-label="Strategy Architect" className={`${mobilePanel === "architect" ? "block" : "hidden"} border-r border-[var(--theme-border)] p-4 xl:block`}>
          <div className="flex items-center gap-2"><Bot className="size-4 text-indigo-primary" /><h2 className="text-sm font-semibold">Strategy Architect</h2></div>
          {!proposalDismissed ? <div className="mt-5 rounded-xl border border-indigo-primary/25 bg-indigo-primary/7 p-4">
            <p className="text-xs font-semibold text-indigo-primary">Prepared change</p>
            <h3 className="mt-3 text-sm font-semibold">{proposal.title}</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{proposal.description}</p>
            <div className="mt-4 flex gap-2">
              <Button type="button" size="sm" disabled={proposalAccepted} onClick={() => { commitNodes([...nodes, proposal.node]); setProposalAccepted(true); }} className="theme-solid-action">{proposalAccepted ? "Accepted" : "Accept change"}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setProposalDismissed(true)}>Dismiss</Button>
            </div>
          </div> : <div role="status" className="mt-5 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] p-4 text-xs text-[var(--text-muted)]">Proposal dismissed for this editing session.</div>}
          <div className="mt-6">
            <div className="flex items-center gap-2 text-xs font-semibold"><History className="size-3.5" /> Version history</div>
            <div className="mt-3 space-y-3">
              {draft.versions.map((version) => <div key={version.id} className="border-t border-[var(--theme-border)] pt-3"><div className="flex items-center justify-between text-xs"><strong>Version {version.number}</strong><span className="text-[var(--text-subtle)]">Draft</span></div><p className="mt-1 text-xs text-[var(--text-muted)]">{version.summary}</p></div>)}
              {draft.versions.length === 0 && <p className="text-xs leading-5 text-[var(--text-muted)]">No saved versions in this prototype session.</p>}
            </div>
          </div>
        </section>

        <section id="studio-panel-tree" role="tabpanel" aria-labelledby="studio-tab-tree" aria-label="Visual Strategy Tree" className={`${mobilePanel === "tree" ? "block" : "hidden"} min-w-0 border-r border-[var(--theme-border)] bg-[var(--theme-bg)] p-4 xl:block xl:p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold">Visual Strategy Tree</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{nodes.length} top-level rules · {draft.symbols.join(", ")}</p></div>
            <div className="flex items-center gap-2">
              <select aria-label="New node type" value={newNodeType} onChange={(event) => setNewNodeType(event.target.value as StrategyNodeType)} className="h-9 rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 text-xs outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:bg-[var(--surface-card-hover)] focus-visible:ring-2 focus-visible:ring-indigo-primary/45 motion-reduce:transition-none">{NODE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select>
              <Button type="button" onClick={addNode} aria-label="Add strategy node" title="Add node" size="icon" className="theme-solid-action"><Plus className="size-4" /></Button>
            </div>
          </div>
          <ol className="mt-5 space-y-2">
            {nodes.map((current, index) => <StrategyNodeRow key={current.id} node={current} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} onMove={(nodeId, direction) => commitNodes(moveNode(nodes, nodeId, direction))} onRemove={(nodeId) => { commitNodes(removeNode(nodes, nodeId)); if (selectedNodeId === nodeId) setSelectedNodeId(null); }} first={index === 0} last={index === nodes.length - 1} depth={0} />)}
          </ol>
          {selectedNode && <div className="mt-5 border-t border-[var(--theme-border)] pt-5"><label className="text-xs font-semibold">Selected rule<input aria-label="Selected node label" value={selectedNode.label} onChange={(event) => commitNodes(updateNode(nodes, selectedNode.id, (current) => ({ ...current, label: event.target.value })))} className="mt-2 h-10 w-full rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-indigo-primary/55 focus-visible:ring-2 focus-visible:ring-indigo-primary/25 motion-reduce:transition-none" /></label><label className="mt-4 block text-xs font-semibold">Rule detail<textarea aria-label="Selected node detail" value={selectedNode.detail} onChange={(event) => commitNodes(updateNode(nodes, selectedNode.id, (current) => ({ ...current, detail: event.target.value })))} rows={3} className="mt-2 w-full resize-none rounded-xl border border-[var(--theme-border-strong)] bg-[var(--surface-control)] p-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-indigo-primary/55 focus-visible:ring-2 focus-visible:ring-indigo-primary/25 motion-reduce:transition-none" /></label></div>}
        </section>

        <section id="studio-panel-preview" role="tabpanel" aria-labelledby="studio-tab-preview" aria-label="Backtest Preview" className={`${mobilePanel === "preview" ? "block" : "hidden"} p-4 xl:block`}>
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Backtest Preview</h2><Status tone={errors.length === 0 ? "positive" : "danger"}>{errors.length === 0 ? "Ready" : `${errors.length} blocked`}</Status></div>
          <div className="mt-5 h-44 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] p-3">
            <svg viewBox="0 0 320 176" preserveAspectRatio="none" role="img" aria-label="Illustrative strategy equity curve" className="h-full w-full">
              <path d="M0 150H320M0 105H320M0 60H320M0 15H320" stroke="currentColor" strokeOpacity=".08" />
              <path d="M0 145 L64 112 L128 128 L192 72 L256 42 L320 15" fill="none" stroke="#7dd3fc" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <path d="M0 145 L64 128 L128 136 L192 104 L256 88 L320 66" fill="none" stroke="#71717a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-3 border-y border-[var(--theme-border)] py-4"><PreviewMetric label="Return" value="+18.0%" /><PreviewMetric label="Benchmark" value="+10.0%" /><PreviewMetric label="Max drawdown" value="-8.4%" /><PreviewMetric label="Sharpe" value="1.31" /></div>
          <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">Illustrative preview only. Historical results do not guarantee future performance.</p>
          <Button render={<Link href={backtestHref(workingDraft)} />} nativeButton={false} variant="outline" size="lg" className="mt-4 w-full"><FlaskConical className="size-4" /> Open deterministic Backtest Lab</Button>

          {showValidation && <div className="mt-5 space-y-2" aria-label="Validation results">{issues.length === 0 ? <div className="flex gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/7 p-3 text-xs"><Check className="size-4 shrink-0 text-emerald-400" /> Structural validation passed.</div> : issues.map((issue) => <div key={issue.id} className={`flex gap-2 rounded-xl border p-3 text-xs ${issue.severity === "error" ? "border-rose-400/25 bg-rose-400/7" : "border-amber-300/25 bg-amber-300/7"}`}><AlertTriangle className={`size-4 shrink-0 ${issue.severity === "error" ? "text-rose-400" : "text-amber-300"}`} />{issue.message}</div>)}</div>}
        </section>
      </main>

      <div className="border-t border-[var(--theme-border)] bg-[var(--surface-header)] px-4 py-3">
        <StudioTabList tabs={["overview", "backtest", "validation", "journal"]} current={resultTab} onSelect={setResultTab} label="Strategy results" idPrefix="result-tab" panelId={() => "strategy-result-panel"} className="max-w-full overflow-x-auto" />
      </div>
      <section id="strategy-result-panel" role="tabpanel" aria-labelledby={`result-tab-${resultTab}`} className="min-h-24 border-t border-[var(--theme-border)] bg-[var(--surface-card)] px-5 py-4 text-sm"><StrategyResultPanel tab={resultTab} draft={workingDraft} issues={issues} /></section>
      </div>

      <AlertDialog open={deployOpen} onOpenChange={setDeployOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader><p className="text-xs font-semibold uppercase text-sky-300">Paper deployment preview</p><AlertDialogTitle>Deploy {draft.name}</AlertDialogTitle><AlertDialogDescription>This records prototype approval only. It does not start a scheduler or submit an order.</AlertDialogDescription></AlertDialogHeader>
          <div className="mt-6 space-y-3 border-y border-white/10 py-4 text-sm"><DeployRow label="Version" value={`Version ${draft.versions[0]?.number ?? 1}`} /><DeployRow label="Mode" value="Paper only" /><DeployRow label="Schedule" value={draft.mode === "investment" ? "Quarterly review" : "Daily after close"} /><DeployRow label="Execution" value="No broker connected" /></div>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deployPaper(draft.id)}>Confirm paper deployment</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StrategyNodeRow({ node, selectedNodeId, onSelect, onMove, onRemove, first, last, depth }: { node: StrategyNode; selectedNodeId: string | null; onSelect: (nodeId: string) => void; onMove: (nodeId: string, direction: -1 | 1) => void; onRemove: (nodeId: string) => void; first: boolean; last: boolean; depth: number }) {
  const selected = selectedNodeId === node.id;
  return <li><div className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border p-3 transition-[background-color,border-color,box-shadow] duration-150 hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)] motion-reduce:transition-none", selected ? "border-indigo-primary/45 bg-indigo-primary/8 shadow-[var(--shadow-control)]" : "border-[var(--theme-border)] bg-[var(--surface-card)]")}><button type="button" onClick={() => onSelect(node.id)} className="min-w-0 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/45"><span className="flex items-center gap-2 text-[11px] font-semibold uppercase text-[var(--text-subtle)]">{titleCase(node.type)} <ChevronRight className={cn("size-3 transition-transform duration-150 motion-reduce:transition-none", selected && "translate-x-0.5")} /></span><strong className="mt-1 block truncate text-sm">{node.label}</strong><span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{node.detail}</span></button><div className="flex items-center gap-1"><IconButton label={`Move ${node.label} up`} disabled={first} onClick={() => onMove(node.id, -1)}><ArrowUp className="size-3.5" /></IconButton><IconButton label={`Move ${node.label} down`} disabled={last} onClick={() => onMove(node.id, 1)}><ArrowDown className="size-3.5" /></IconButton><IconButton label={`Remove ${node.label}`} onClick={() => onRemove(node.id)}><Trash2 className="size-3.5" /></IconButton></div></div>{node.children.length > 0 && <ol aria-label={`${node.label} rules`} className="mt-2 space-y-2 border-l border-[var(--theme-border-strong)] pl-3">{node.children.map((child, index) => <StrategyNodeRow key={child.id} node={child} selectedNodeId={selectedNodeId} onSelect={onSelect} onMove={onMove} onRemove={onRemove} first={index === 0} last={index === node.children.length - 1} depth={depth + 1} />)}</ol>}</li>;
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} variant="outline" size="icon-sm">{children}</Button>;
}

function StudioTabList<T extends string>({ tabs, current, onSelect, label, idPrefix, panelId, className }: { tabs: readonly T[]; current: T; onSelect: (tab: T) => void; label: string; idPrefix: string; panelId: (tab: T) => string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex w-max items-center rounded-full border border-[var(--theme-border)] bg-[var(--surface-header)] px-1", className)}>
      {tabs.map((tab) => {
        const active = current === tab;
        return (
          <button
            key={tab}
            id={`${idPrefix}-${tab}`}
            type="button"
            role="tab"
            aria-controls={panelId(tab)}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => handleTabKey(event, tabs, current, onSelect)}
            onClick={() => onSelect(tab)}
            className={cn("relative h-11 min-w-0 shrink-0 px-4 text-xs font-semibold capitalize text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-primary/45 motion-reduce:transition-none", active && "text-[var(--text-primary)]")}
          >
            {tab}
            {active && <span aria-hidden="true" className="pointer-events-none absolute bottom-1.5 left-1/2 h-1 w-8 -translate-x-1/2"><span className="workspace-tab-line absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rounded-full bg-[var(--text-primary)]" /></span>}
          </button>
        );
      })}
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function DeployRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-[var(--text-muted)]">{label}</span><strong>{value}</strong></div>; }
function StrategyResultPanel({ tab, draft, issues }: { tab: ResultTab; draft: StrategyDraft; issues: ReturnType<typeof validateStrategy> }) {
  if (tab === "backtest") return <div><strong>Deterministic handoff</strong><p className="mt-1 text-[var(--text-muted)]">{draft.template.replaceAll("_", " ")} · {draft.symbols.join(", ")} · fees and slippage configured in Backtest Lab</p></div>;
  if (tab === "validation") return <div><strong>{issues.length === 0 ? "Validation passed" : `${issues.length} validation items`}</strong><p className="mt-1 text-[var(--text-muted)]">{issues[0]?.message ?? "Required structure and risk controls are present."}</p></div>;
  if (tab === "journal") return <div><strong>{draft.versions.length} saved versions</strong><p className="mt-1 text-[var(--text-muted)]">{draft.status === "paper" ? "Paper deployment approval is recorded in the Decision Journal." : "Save a version before approving paper deployment."}</p></div>;
  return <div><strong>{draft.name}</strong><p className="mt-1 text-[var(--text-muted)]">{draft.nodes.length} top-level rules · {draft.mode} mode · {draft.status}</p></div>;
}
function handleTabKey<T extends string>(event: React.KeyboardEvent<HTMLButtonElement>, tabs: readonly T[], current: T, select: (tab: T) => void) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = tabs.indexOf(current);
  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  const next = tabs[nextIndex];
  select(next);
  document.getElementById(event.currentTarget.id.replace(current, next))?.focus();
}
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()); }
function findNode(nodes: StrategyNode[], id: string | null): StrategyNode | null { if (!id) return null; for (const current of nodes) { if (current.id === id) return current; const child = findNode(current.children, id); if (child) return child; } return null; }
