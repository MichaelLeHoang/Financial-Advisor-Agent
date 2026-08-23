/*
THESIS: The Lab is an evidence dossier, not another product dashboard; it refuses the usual leaderboard of unsupported model scores.
OWN-WORLD: Quanfora black, ink-white type, cool spectral diagrams, fine rules, and large research figures modeled after a technical exhibit.
STORY: See the frozen forecast question, inspect each registered model, understand the untouched-fold test, then verify the source.
FIRST VIEWPORT: An editorial thesis and repository action sit beside the 96-bar-to-one-endpoint contract at full figure scale.
FORM: Public long-form research article; the model architecture itself supplies the imagery and the scroll rhythm.
*/

import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  CircleDashed,
  ExternalLink,
  FileCheck2,
  FlaskConical,
  GitBranch,
  GitCommitHorizontal,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";
import { IntroductionFooter, IntroductionNav } from "@/app/introduction/components";
import {
  FINANCIAL_MODEL_LAB_URL,
  getFinancialModelLabSnapshot,
  type LabModelFamily,
} from "@/lib/financial-model-lab";
import {
  ForecastContractFigure,
  ModelArchitectureFigure,
  WalkForwardFigure,
  type LabFigureKind,
} from "./LabFigures";

export const metadata: Metadata = {
  title: "The Lab",
  description: "Inside Quanfora's reproducible model research: registered architectures, leakage-safe evaluation, and the evidence required before promotion.",
};

export const revalidate = 3600;

type ModelStory = {
  kind: LabFigureKind;
  kicker: string;
  title: string;
  summary: string;
  distinction: string;
  specs: string[];
};

const MODEL_STORIES: Record<string, ModelStory> = {
  "rf-lstm": {
    kind: "rf-lstm",
    kicker: "Reproduction anchor",
    title: "Random Forest meets sequence memory",
    summary: "The first candidate family compares a tabular tree model with a recurrent network over the same feature pack and the same prediction endpoints.",
    distinction: "Finite tuning is selected only on inner-validation MAE. The chosen LSTM architecture is then repeated across three deterministic seeds.",
    specs: ["5 RF trials", "4 LSTM trials", "96-bar sequences", "3 evaluation seeds"],
  },
  xgboost: {
    kind: "xgboost",
    kicker: "Boosted-tree extension",
    title: "A disciplined nonlinear baseline",
    summary: "XGBoost adds trees sequentially so each one corrects residual error left by the ensemble before it. It is intentionally registered untuned.",
    distinction: "The configuration freezes 300 trees, depth 6, learning rate 0.05, histogram training, and one deterministic seed before outer-fold labels are viewed.",
    specs: ["300 trees", "Depth 6", "Learning rate 0.05", "Seed 1729"],
  },
  tcn: {
    kind: "tcn",
    kicker: "Causal sequence extension",
    title: "Wide memory without recurrence",
    summary: "The Temporal Convolutional Network reads the 96-bar window through causal, dilated residual blocks. Every output can depend only on information available at that point in time.",
    distinction: "Five dilation levels create a 125-bar theoretical receptive field while the actual input stays fixed to 96 complete bars.",
    specs: ["5 residual blocks", "Dilations 1–16", "32 channels", "50 epochs max"],
  },
  patchtst: {
    kind: "patchtst",
    kicker: "Patch-based transformer",
    title: "The history, read in overlapping patches",
    summary: "PatchTST-style processing breaks each feature channel into compact overlapping windows before a shared Transformer encoder looks for longer-range structure.",
    distinction: "This is a registered scalar-target adaptation—not a claim of exact paper reproduction—and its task-specific head estimates one future return.",
    specs: ["11 patches/channel", "16-bar patches", "4 attention heads", "2 encoder layers"],
  },
  "chronos-zero-shot": {
    kind: "chronos-zero-shot",
    kicker: "Pinned foundation model",
    title: "Chronos-2, with no task-specific fitting",
    summary: "The zero-shot candidate uses a checksummed Chronos-2 checkpoint. Historical return is the target series and the other registered features remain past-only covariates.",
    distinction: "The model forecasts four steps and the registered point forecast is the fourth-step median. Cross-learning and future covariates are disabled.",
    specs: ["120M parameters", "96-bar context", "4-step horizon", "0.1 / 0.5 / 0.9 quantiles"],
  },
  "chronos-lora": {
    kind: "chronos-lora",
    kicker: "Parameter-efficient adaptation",
    title: "A small trainable layer over a frozen base",
    summary: "The LoRA candidate keeps the pinned Chronos-2 base unchanged and fits low-rank adapters using eligible fold-training labels only.",
    distinction: "Inner-validation quantile loss selects the checkpoint. Training masks steps one through three and supervises only the registered fourth-step return.",
    specs: ["Rank 8", "Alpha 16", "500 steps max", "3 deterministic seeds"],
  },
};

const SUCCESS_GATES = [
  ["Predictive lift", "At least 2% lower aggregate MAE than the zero-return baseline."],
  ["Fold consistency", "Beat the strongest naive MAE baseline in at least 4 of 6 untouched months."],
  ["Economic survival", "Outperform after 5 bps per side in at least 4 of 6 folds, with positive aggregate net return."],
  ["Reproducibility", "Persist code, data identity, predictions, costs, seeds, and checksummed artifacts."],
] as const;

export default async function LabPage() {
  const lab = await getFinancialModelLabSnapshot();
  const hasPublishedEvidence = lab.goldIdentityCount > 0 && lab.evaluationPacketCount > 0;
  const hasPromotionManifest = lab.promotionManifestCount > 0;
  const annotationsAreCurrent = lab.latestCommit.sha === lab.annotationsAsOfSha;
  const sourceLabel = lab.sourceStatus === "live" ? "Live GitHub inventory" : "Last verified repository snapshot";
  const promotionStatus = hasPromotionManifest ? "Shadow registered" : hasPublishedEvidence ? "Awaiting review" : "Blocked";
  const promotionDetail = hasPromotionManifest ? "Registered manifest; no order placement" : hasPublishedEvidence ? "Evidence exists; no manifest registered" : "No real-data packet registered";

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <IntroductionNav forceTheme="Deep Space" />

      <article>
        <header className="mx-auto max-w-7xl px-5 pb-14 pt-28 sm:px-8 sm:pb-20 sm:pt-36 lg:px-10">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,.88fr)_minmax(520px,1.12fr)] lg:gap-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-white/62">
                <FlaskConical className="size-3.5 text-cyan-300" />
                Quanfora research · public notebook
              </div>
              <h1 className="mt-7 max-w-3xl font-heading text-5xl font-semibold leading-[0.98] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.75rem]">
                Models earn their way out of the lab.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
                One frozen question. Six untouched months. No score reaches Quanfora until its data, timing, costs, and lineage survive the same reproducible test.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#registered-models"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black transition-colors hover:bg-white/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  Explore the models <ArrowRight className="size-4" />
                </a>
                <a
                  href={lab.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open private research source on GitHub; collaborator access required"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.14] px-5 text-sm font-semibold text-white/78 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  Open research source <LockKeyhole className="size-3.5" />
                </a>
              </div>
              <p className="mt-4 text-xs leading-5 text-white/55">Private GitHub · collaborator access required</p>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/55">
                <span className="inline-flex items-center gap-2"><GitBranch className="size-3.5" /> {lab.branch}</span>
                <span>BTCUSDT spot</span>
                <span>15-minute bars → 1-hour return</span>
              </div>
            </div>

            <ForecastContractFigure />
          </div>

          <dl className="mt-12 grid border-y border-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            <LabMetric label="Registered configs" value={String(lab.modelConfigCount)} detail="Versioned model contracts" />
            <LabMetric label="Feature pack" value="16" detail="Past-only core_v1 features" />
            <LabMetric label="Untouched folds" value="6" detail="January–June 2026" />
            <LabMetric label="Promotion" value={promotionStatus} detail={promotionDetail} />
          </dl>
        </header>

        <section className="border-y border-amber-300/22 bg-amber-300/[0.045]">
          <div className="mx-auto flex max-w-7xl items-start gap-4 px-5 py-5 sm:px-8 lg:px-10">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-200" />
            <div className="max-w-5xl">
              <p className="text-sm font-semibold text-amber-100">{hasPublishedEvidence ? "Registered evidence is still research" : "What this page is—and is not"}</p>
              <p className="mt-1 text-sm leading-6 text-amber-50/64">
                {hasPublishedEvidence
                  ? `The repository contains ${lab.evaluationPacketCount} evaluation ${lab.evaluationPacketCount === 1 ? "packet" : "packets"}. This remains research, not a trading signal or profitability claim; ${hasPromotionManifest ? "the registered deployment is shadow-only and cannot place orders" : "no promotion manifest is registered"}.`
                  : "This is a view of registered research contracts, not a signal gallery. The current repository does not contain a registered gold identity or completed real-data evaluation packet, so no performance, profitability, or production-readiness claim is shown."}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-cyan-200">The registered question</p>
            <h2 className="mt-4 font-heading text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-5xl">
              Can a model estimate the next one-hour BTC spot return without borrowing information from the future?
            </h2>
            <p className="mt-6 text-base leading-8 text-white/55">
              Every candidate receives the same 96 completed 15-minute bars, the same 16-feature pack, and the same four-bar target. A signal forms only after bar <span className="font-mono text-sm text-white/78">t</span> closes; simulated execution cannot begin before the open of <span className="font-mono text-sm text-white/78">t+1</span>.
            </p>
          </div>
          <div className="mt-12 grid gap-8 border-t border-white/[0.08] pt-10 sm:grid-cols-3">
            <ResearchFact title="Frozen instrument" detail="Binance BTCUSDT spot. No leverage, futures, options, or silent venue substitution." />
            <ResearchFact title="Frozen timing" detail="15-minute canonical bars, a 96-bar context, and one four-bar forward endpoint." />
            <ResearchFact title="Frozen comparison" detail="All candidates meet the same baselines, split policy, execution delay, and costs." />
          </div>
        </section>

        <section id="registered-models" className="scroll-mt-24 border-t border-white/[0.08]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-indigo-300">The registered suite</p>
              <h2 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.025em] sm:text-5xl">Different machinery. Identical evidence rules.</h2>
              <p className="mt-5 text-base leading-7 text-white/55">Configuration tells us what will be tested; it does not prove what will work. Each diagram below is derived from a versioned model contract in the lab repository.</p>
              <p className="mt-3 text-xs leading-5 text-white/55">
                Editorial specifications verified at commit <span className="font-mono text-white/78">{lab.annotationsAsOfSha}</span>
                {!annotationsAreCurrent && <> · repository inventory is newer at <span className="font-mono text-white/78">{lab.latestCommit.sha}</span></>}.
              </p>
            </div>

            <div className="mt-16 border-t border-white/[0.09]">
              {lab.modelFamilies.map((model, index) => (
                <ModelChapter key={model.id} model={model} index={index} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.08] bg-[#08090d]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,.72fr)_minmax(560px,1.28fr)] lg:items-end">
              <div className="max-w-xl">
                <p className="text-sm font-semibold text-cyan-200">The time test</p>
                <h2 className="mt-4 font-heading text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-5xl">A backtest cannot shuffle time.</h2>
                <p className="mt-6 text-base leading-8 text-white/52">Six calendar months are held out in sequence. Training expands forward, validation stays behind the test month, and a 100-bar embargo separates the regions.</p>
                <p className="mt-4 text-sm leading-7 text-white/55">Scalers, thresholds, early stopping, hyperparameters, and seeds are frozen before the corresponding outer-test targets are loaded.</p>
              </div>
              <WalkForwardFigure />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,.8fr)_minmax(520px,1.2fr)]">
            <div>
              <p className="text-sm font-semibold text-indigo-300">The acceptance bar</p>
              <h2 className="mt-4 max-w-xl font-heading text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-5xl">Accuracy alone does not earn promotion.</h2>
              <p className="mt-6 max-w-xl text-base leading-8 text-white/52">Forecast error and economic usefulness are reported separately. A model can predict more accurately and still fail after delayed execution, turnover, or costs.</p>
              <a
                href={`${FINANCIAL_MODEL_LAB_URL}/blob/main/experiments/charters/btc_spot_15m_1h_v1.md`}
                target="_blank"
                rel="noreferrer"
                aria-label="Read the private experiment charter on GitHub; collaborator access required"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white/76 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                Read private experiment charter <LockKeyhole className="size-3.5" /> <ExternalLink className="size-3.5" />
              </a>
              <p className="mt-3 text-xs text-white/55">Private GitHub · collaborator access required</p>
            </div>

            <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {SUCCESS_GATES.map(([title, detail], index) => (
                <div key={title} className="grid gap-3 py-6 sm:grid-cols-[48px_160px_minmax(0,1fr)] sm:items-start">
                  <span className="font-mono text-xs text-white/28">0{index + 1}</span>
                  <p className="text-sm font-semibold text-white/82">{title}</p>
                  <p className="text-sm leading-6 text-white/55">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.08]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
            <div className="flex flex-col gap-8 border-b border-white/[0.08] pb-10 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-cyan-200">Model performance</p>
                <h2 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.025em] sm:text-5xl">{hasPublishedEvidence ? "Registered evidence is ready for inspection." : "Evidence will appear here when it exists."}</h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 text-xs text-white/55">
                {hasPublishedEvidence ? <Check className="size-4 text-cyan-200" /> : <CircleDashed className="size-4 text-amber-200" />}
                {hasPublishedEvidence ? `${lab.evaluationPacketCount} registered evaluation ${lab.evaluationPacketCount === 1 ? "packet" : "packets"}` : "No registered real-data packet"}
              </span>
            </div>

            <div className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="max-w-3xl">
                <p className="text-lg leading-8 text-white/62">
                  {hasPublishedEvidence
                    ? "Every displayed result must resolve back to its registered dataset identity, code revision, prediction rows, confidence intervals, and cost assumptions. Promotion remains a separate reviewed gate."
                    : "Quanfora will not fill an empty report with synthetic winners, sample Sharpe ratios, or illustrative accuracy. When the registered folds are complete, this section can resolve every number back to its dataset identity, code revision, prediction rows, and cost assumptions."}
                </p>
                <div className="mt-9 grid gap-4 sm:grid-cols-2">
                  <EvidenceItem icon={<FileCheck2 className="size-4" />} title="Predictive packet" detail="MAE, RMSE, directionality, bias, correlation, and fold-level confidence intervals." />
                  <EvidenceItem icon={<Check className="size-4" />} title="Economic packet" detail="Gross and net return, turnover, drawdown, and sensitivity at 2, 5, and 10 bps per side." />
                </div>
              </div>
              <div className="border-l border-white/[0.08] pl-6">
                <p className="text-xs text-white/55">Repository status</p>
                <p className="mt-2 text-sm font-semibold text-white/78">{sourceLabel}</p>
                <p className="mt-5 text-xs text-white/55">Latest commit · Private GitHub</p>
                <a href={lab.latestCommit.url} target="_blank" rel="noreferrer" aria-label={`${lab.latestCommit.message}; open private GitHub commit, collaborator access required`} className="mt-2 block text-sm font-semibold leading-6 text-white/78 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                  {lab.latestCommit.message}
                </a>
                <p className="mt-2 inline-flex items-center gap-2 font-mono text-[11px] text-white/55"><GitCommitHorizontal className="size-3.5" /> {lab.latestCommit.sha} · {formatDate(lab.latestCommit.date)}</p>
              </div>
            </div>

            {lab.sourceStatus === "fallback" && (
              <p className="flex items-start gap-2 border-t border-white/[0.08] pt-5 text-xs leading-5 text-amber-100/64">
                <CircleDashed className="mt-0.5 size-3.5 shrink-0" /> GitHub could not be refreshed for this request. Counts and source activity use the last verified repository snapshot.
              </p>
            )}
          </div>
        </section>
      </article>

      <IntroductionFooter />
    </main>
  );
}

function ModelChapter({ model, index }: { model: LabModelFamily; index: number }) {
  const story = MODEL_STORIES[model.id] ?? {
    kind: "generic" as const,
    kicker: model.stage,
    title: model.name,
    summary: model.approach,
    distinction: model.evidence,
    specs: [`${model.configPaths.length} registered ${model.configPaths.length === 1 ? "configuration" : "configurations"}`],
  };
  const figureFirst = index % 2 === 0;

  return (
    <section className="grid gap-9 border-b border-white/[0.09] py-14 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20">
      <div className={figureFirst ? "lg:order-1" : "lg:order-2"}>
        <ModelArchitectureFigure kind={story.kind} />
      </div>
      <div className={figureFirst ? "lg:order-2" : "lg:order-1"}>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-cyan-200">{story.kicker}</span>
          <span className="text-white/24">·</span>
          <span className="text-white/55">{model.stage}</span>
          {model.stage === "New entry" && <span className="rounded-full border border-amber-200/24 px-2 py-0.5 text-amber-100/80">Annotations pending</span>}
        </div>
        <h3 className="mt-4 max-w-xl font-heading text-2xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">{story.title}</h3>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/55">{story.summary}</p>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55">{story.distinction}</p>
        <ul className="mt-7 flex flex-wrap gap-2" aria-label={`${model.name} registered specifications`}>
          {story.specs.map((spec) => <li key={spec} className="rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-2 text-xs text-white/55">{spec}</li>)}
        </ul>
        <a href={model.configPaths[0]} target="_blank" rel="noreferrer" aria-label={`Inspect the private ${model.name} configuration on GitHub; collaborator access required`} className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
          Inspect private config <span className="font-normal text-white/55">· access required</span> <LockKeyhole className="size-3" /> <ArrowRight className="size-3.5" />
        </a>
      </div>
    </section>
  );
}

function LabMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="py-6 sm:px-5 sm:first:pl-0 lg:border-l lg:border-white/[0.08] lg:first:border-l-0">
      <dt className="text-xs text-white/55">{label}</dt>
      <dd className="mt-2 text-xl font-semibold text-white/88">{value}</dd>
      <dd className="mt-1 text-xs text-white/55">{detail}</dd>
    </div>
  );
}

function ResearchFact({ title, detail }: { title: string; detail: string }) {
  return <div><p className="text-sm font-semibold text-white/82">{title}</p><p className="mt-2 text-sm leading-6 text-white/55">{detail}</p></div>;
}

function EvidenceItem({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="border-t border-white/[0.1] pt-4">
      <div className="flex items-center gap-2 text-white/72">{icon}<p className="text-sm font-semibold">{title}</p></div>
      <p className="mt-2 text-sm leading-6 text-white/55">{detail}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
