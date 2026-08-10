"use client";

import {
  Activity,
  Blocks,
  CircleDollarSign,
  Coins,
  Database,
  Gauge,
  Loader2,
  Network,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip, MetricLabel } from "@/components/ui/info-tooltip";
import type { CryptoContext, CryptoOverview } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tone = "cyan" | "emerald" | "indigo" | "amber" | "rose" | "violet";

const TONES: Record<Tone, { icon: string; value: string; wash: string }> = {
  cyan: { icon: "text-cyan-300", value: "text-cyan-200", wash: "bg-cyan-400/[0.035]" },
  emerald: { icon: "text-emerald-300", value: "text-emerald-300", wash: "bg-emerald-400/[0.035]" },
  indigo: { icon: "text-indigo-300", value: "text-indigo-200", wash: "bg-indigo-400/[0.045]" },
  amber: { icon: "text-amber-300", value: "text-amber-200", wash: "bg-amber-400/[0.035]" },
  rose: { icon: "text-rose-300", value: "text-rose-300", wash: "bg-rose-400/[0.035]" },
  violet: { icon: "text-violet-300", value: "text-violet-200", wash: "bg-violet-400/[0.04]" },
};

function compact(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: digits }).format(value);
}

function money(value: number | null | undefined, quote = "USD") {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: quote === "USDT" ? "USD" : quote,
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000 ? 1 : 2,
  }).format(value).replace("US$", quote === "USDT" ? "USDT " : "US$");
}

function Heading({ title, label, children, live }: { title: string; label: string; children: React.ReactNode; live?: boolean }) {
  return (
    <CardHeader className="border-b border-[var(--theme-border)] py-4">
      <div className="flex min-w-0 items-center gap-2">
        <CardTitle className="truncate">{title}</CardTitle>
        {live && <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400" />Live</span>}
        <InfoTooltip label={label} side="bottom">{children}</InfoTooltip>
      </div>
    </CardHeader>
  );
}

function Source({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-[var(--theme-border)] px-5 py-3 text-[11px] text-[var(--text-subtle)]">Source: {children}</p>;
}

function Metric({ label, value, description, tone, icon: Icon }: { label: string; value: string; description: string; tone: Tone; icon?: typeof Activity }) {
  const palette = TONES[tone];
  return (
    <div className={cn("min-w-0 px-4 py-4", palette.wash)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", palette.icon)} />}
        <MetricLabel label={label} description={description} />
      </div>
      <p className={cn("mt-2 truncate text-lg font-semibold tabular-nums", palette.value)} title={value}>{value}</p>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return <div role="status" className="grid min-h-52 place-items-center text-sm text-[var(--text-muted)]"><span><Loader2 className="mr-2 inline size-4 animate-spin motion-reduce:animate-none" />Loading {label}</span></div>;
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-52 place-items-center px-6 text-center text-sm text-[var(--text-muted)]">{children}</div>;
}

function regime(overview: CryptoOverview | null, context: CryptoContext | null) {
  const change = overview?.change_24h;
  const sentiment = context?.fear_greed?.current_value;
  if (change != null && sentiment != null && change > 0 && sentiment >= 56) return { label: "Constructive", tone: "emerald" as const };
  if (change != null && sentiment != null && change < 0 && sentiment <= 44) return { label: "Defensive", tone: "rose" as const };
  return { label: "Mixed", tone: "amber" as const };
}

export default function BitcoinContextCards({ context, overview, loading }: { context: CryptoContext | null; overview: CryptoOverview | null; loading: boolean }) {
  const posture = regime(overview, context);
  const sentiment = context?.fear_greed;
  const mempool = context?.mempool;
  const network = context?.network;
  const defi = context?.defi;
  const market = context?.market;
  const maxSupply = overview?.max_supply;
  const circulating = overview?.circulating_supply;
  const minedPct = maxSupply && circulating ? Math.min(100, (circulating / maxSupply) * 100) : null;
  const remaining = maxSupply && circulating ? Math.max(0, maxSupply - circulating) : null;
  const mempoolMegabytes = mempool?.virtual_size_bytes != null ? mempool.virtual_size_bytes / 1_000_000 : null;
  const largestChainTvl = defi?.top_chains[0]?.tvl_usd ?? 0;

  return (
    <>
      <Card className="gap-0 py-0">
        <Heading title="Bitcoin state" label="How Bitcoin state is summarized">
          <strong>What this shows</strong>
          <p className="mt-1 text-[var(--text-muted)]">A scan-friendly view of price, liquidity, market share, and sentiment. “Constructive” requires both a positive 24-hour move and greed; “Defensive” requires both a negative move and fear. All other combinations are mixed.</p>
          <p className="mt-2 text-[var(--text-subtle)]">The posture is descriptive, not a trading signal or a proprietary cycle score.</p>
        </Heading>
        <CardContent className="grid gap-px bg-[var(--theme-border)] p-0 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Market posture" value={posture.label} description="A plain-language combination of the latest 24-hour direction and Fear & Greed reading." tone={posture.tone} icon={Activity} />
          <Metric label="BTC price" value={money(overview?.price, overview?.quote_currency)} description="Current composite Bitcoin price in the selected quote currency." tone="cyan" icon={CircleDollarSign} />
          <Metric label="24h change" value={overview?.change_24h == null ? "—" : `${overview.change_24h >= 0 ? "+" : ""}${overview.change_24h.toFixed(2)}%`} description="Percentage price change over the latest rolling 24-hour period." tone={(overview?.change_24h ?? 0) >= 0 ? "emerald" : "rose"} icon={Activity} />
          <Metric label="Market cap" value={money(overview?.market_cap, overview?.quote_currency)} description="Current price multiplied by estimated circulating supply." tone="indigo" icon={Coins} />
          <Metric label="BTC dominance" value={market?.bitcoin_dominance_pct == null ? "—" : `${market.bitcoin_dominance_pct.toFixed(1)}%`} description="Bitcoin's share of the total tracked crypto market capitalization." tone="violet" icon={Gauge} />
          <Metric label="Sentiment" value={sentiment?.current_value == null ? "—" : `${sentiment.current_value} · ${sentiment.current_classification}`} description="Alternative.me Fear & Greed Index from 0 to 100." tone={(sentiment?.current_value ?? 50) < 45 ? "rose" : (sentiment?.current_value ?? 50) > 55 ? "emerald" : "amber"} icon={Gauge} />
        </CardContent>
        <Source>CoinGecko · Alternative.me</Source>
      </Card>

      <div className="grid items-stretch gap-4 xl:grid-cols-2">
        <Card className="gap-0 py-0">
          <Heading title="Mempool and fees" label="About mempool demand" live>
            <strong>What this shows</strong>
            <p className="mt-1 text-[var(--text-muted)]">The mempool contains valid transactions waiting for confirmation. Backlog size describes current demand; fee estimates show satoshis per virtual byte for different urgency levels and do not guarantee confirmation time.</p>
          </Heading>
          {loading && !mempool ? <LoadingCard label="mempool demand" /> : mempool ? <CardContent className="grid grid-cols-2 gap-px bg-[var(--theme-border)] p-0 sm:grid-cols-3">
            <Metric label="Block height" value={mempool.block_height?.toLocaleString() ?? "—"} description="Most recent Bitcoin block height observed by mempool.space." tone="amber" icon={Blocks} />
            <Metric label="Unconfirmed" value={mempool.unconfirmed_transactions?.toLocaleString() ?? "—"} description="Transactions currently waiting in the public mempool snapshot." tone="violet" icon={Activity} />
            <Metric label="Backlog size" value={mempoolMegabytes == null ? "—" : `${mempoolMegabytes.toFixed(1)} MB`} description="Virtual size of transactions waiting for confirmation." tone="indigo" icon={Database} />
            <Metric label="Fast priority" value={mempool.fastest_fee_sats_vb == null ? "—" : `${mempool.fastest_fee_sats_vb} sat/vB`} description="Suggested fee rate for the highest current priority." tone="rose" icon={Gauge} />
            <Metric label="About 30 min" value={mempool.half_hour_fee_sats_vb == null ? "—" : `${mempool.half_hour_fee_sats_vb} sat/vB`} description="Suggested fee rate targeting confirmation in roughly 30 minutes under current conditions." tone="cyan" icon={Gauge} />
            <Metric label="Economy" value={mempool.economy_fee_sats_vb == null ? "—" : `${mempool.economy_fee_sats_vb} sat/vB`} description="Lower-priority suggested fee rate for users who can wait." tone="emerald" icon={Gauge} />
          </CardContent> : <EmptyCard>Live mempool data is temporarily unavailable. Other Bitcoin analytics remain usable.</EmptyCard>}
          <Source>mempool.space · refreshed about every minute</Source>
        </Card>

        <Card className="gap-0 py-0">
          <Heading title="Network health" label="About Bitcoin network metrics" live>
            <strong>What this shows</strong>
            <p className="mt-1 text-[var(--text-muted)]">Hash rate estimates mining power, difficulty controls block production, and daily blocks and transactions describe recent settlement activity. Higher is not automatically better for price.</p>
          </Heading>
          {loading && !network ? <LoadingCard label="network health" /> : network ? <CardContent className="grid grid-cols-2 gap-px bg-[var(--theme-border)] p-0">
            <Metric label="Hash rate" value={network.hash_rate == null ? "—" : `${compact(network.hash_rate, 2)} H/s`} description="Estimated computing power securing the Bitcoin network." tone="emerald" icon={Network} />
            <Metric label="Difficulty" value={compact(network.difficulty, 2)} description="Current relative difficulty of producing a valid block." tone="indigo" icon={Gauge} />
            <Metric label="Transactions · 24h" value={network.transactions_24h?.toLocaleString() ?? "—"} description="Transactions included in blocks during the latest 24-hour provider window." tone="cyan" icon={Activity} />
            <Metric label="Blocks · 24h" value={network.blocks_mined_24h?.toLocaleString() ?? "—"} description="Blocks mined during the latest 24-hour provider window." tone="amber" icon={Blocks} />
          </CardContent> : <EmptyCard>Network telemetry is temporarily unavailable.</EmptyCard>}
          <Source>Blockchain.com · delayed provider snapshot</Source>
        </Card>

        <Card className="gap-0 py-0">
          <Heading title="Bitcoin supply" label="About Bitcoin supply">
            <strong>What this shows</strong>
            <p className="mt-1 text-[var(--text-muted)]">Estimated circulating Bitcoin compared with the protocol's 21 million maximum. Lost coins are not deducted, so circulating supply does not mean actively tradable supply.</p>
          </Heading>
          <CardContent className="px-5 py-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><MetricLabel label="Circulating" description="Estimated coins already issued and circulating." /><p className="mt-2 text-xl font-semibold tabular-nums text-amber-200">{compact(circulating, 3)} BTC</p></div>
              <div><MetricLabel label="Maximum" description="Protocol-defined maximum Bitcoin supply." /><p className="mt-2 text-xl font-semibold tabular-nums">{compact(maxSupply, 3)} BTC</p></div>
              <div><MetricLabel label="Remaining" description="Maximum supply minus estimated circulating supply." /><p className="mt-2 text-xl font-semibold tabular-nums text-cyan-200">{compact(remaining, 3)} BTC</p></div>
            </div>
            <div className="mt-7 h-2.5 overflow-hidden rounded-full bg-[var(--surface-control)]" role="progressbar" aria-label="Bitcoin supply mined" aria-valuemin={0} aria-valuemax={100} aria-valuenow={minedPct ?? undefined}>
              <div className="h-full rounded-full bg-amber-400 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${minedPct ?? 0}%` }} />
            </div>
            <p className="mt-2 text-right text-xs font-semibold tabular-nums text-amber-200">{minedPct == null ? "Supply unavailable" : `${minedPct.toFixed(2)}% issued`}</p>
          </CardContent>
          <Source>CoinGecko supply estimate · Bitcoin protocol maximum</Source>
        </Card>

        <Card className="gap-0 py-0">
          <Heading title="DeFi landscape" label="About DeFi context">
            <strong>What this shows</strong>
            <p className="mt-1 text-[var(--text-muted)]">Total value locked across tracked chains and the latest 24-hour decentralized-exchange volume. This is broad crypto-market context, not value locked specifically in Bitcoin.</p>
            <p className="mt-2 text-[var(--text-subtle)]">Chain totals can overlap through bridged assets and depend on DefiLlama methodology.</p>
          </Heading>
          {loading && !defi ? <LoadingCard label="DeFi context" /> : defi ? <CardContent className="px-5 py-5">
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div><MetricLabel label="Tracked chain TVL" description="Sum of current chain-level TVL values returned by DefiLlama." /><p className="mt-2 text-2xl font-semibold tabular-nums text-violet-200">{money(defi.total_value_locked_usd)}</p></div>
              <div><MetricLabel label="DEX volume · 24h" description="Reported decentralized-exchange volume over the latest 24 hours." /><p className="mt-2 text-2xl font-semibold tabular-nums text-cyan-200">{money(defi.dex_volume_24h_usd)}</p></div>
            </div>
            <div className="mt-6 space-y-3" aria-label="Top chains by total value locked">
              {defi.top_chains.slice(0, 5).map((chain) => <div key={chain.name} className="grid grid-cols-[90px_minmax(0,1fr)_80px] items-center gap-3 text-xs"><span className="truncate font-medium">{chain.name}</span><span className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-control)]"><span className="block h-full rounded-full bg-violet-400" style={{ width: `${largestChainTvl ? Math.max(4, chain.tvl_usd / largestChainTvl * 100) : 0}%` }} /></span><span className="text-right tabular-nums text-[var(--text-muted)]">{money(chain.tvl_usd)}</span></div>)}
            </div>
          </CardContent> : <EmptyCard>DeFi context is temporarily unavailable.</EmptyCard>}
          <Source>DefiLlama · broad crypto context</Source>
        </Card>
      </div>
    </>
  );
}
