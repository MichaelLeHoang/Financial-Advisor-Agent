"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

/* Google-Finance-style "US market summary": a list of headline rows, each
   collapsed to just the headline + a "sources" button + a circular chevron.
   Expanding a row reveals the story body and an AI deep-dive link. The
   sources button shows the favicons of the sites used to craft the summary
   and opens a popover listing the reference resources. */

interface Source {
  title: string;
  url: string;
}

interface SummaryStory {
  headline: string;
  body: string;
  sources: Source[];
}

const STORIES: SummaryStory[] = [
  {
    headline: "Major indexes finish higher following blockbuster SpaceX debut",
    body:
      "U.S. equity markets closed broadly higher on Friday, June 12, 2026, marking the tenth winning week in the last eleven for the S&P 500. Investor sentiment was bolstered by the highly anticipated market debut of SpaceX, which surged 19% in its first day of trading to reach a market capitalization of $2.1 trillion. While the Dow Jones Industrial Average led the gains with a 0.7% rise, the Nasdaq and S&P 500 followed with gains of 0.3% and 0.5% respectively.",
    sources: [
      { title: "SpaceX soars 19% in record-breaking market debut", url: "https://www.reuters.com/markets/spacex-ipo-debut" },
      { title: "S&P 500 notches tenth winning week in eleven", url: "https://www.cnbc.com/markets/sp500-weekly-close" },
      { title: "Wall Street closes higher as SpaceX listing electrifies investors", url: "https://www.bloomberg.com/news/markets-wrap" },
    ],
  },
  {
    headline: "Optimism over Middle East peace deal drives oil prices down",
    body:
      "Energy markets saw a significant decline as Brent crude fell over 3% to settle near $87 per barrel following reports of a potential breakthrough in negotiations between the U.S. and Iran. This shift has begun to unwind the war risk premium that previously inflated energy costs and stoked global inflation fears. Market participants remain hopeful that an imminent deal could reopen the Strait of Hormuz, restoring vital global oil delivery routes.",
    sources: [
      { title: "Brent crude slides over 3% on U.S.-Iran talks", url: "https://www.reuters.com/markets/commodities/oil-prices-iran" },
      { title: "Oil retreats as war risk premium unwinds", url: "https://www.bloomberg.com/energy/oil-risk-premium" },
      { title: "Strait of Hormuz reopening hopes pressure crude", url: "https://www.cnbc.com/energy/strait-of-hormuz-oil" },
    ],
  },
  {
    headline: "Mixed results for AI and technology sectors despite IPO momentum",
    body:
      "While SpaceX's successful listing provided a thematic lift to the technology sector, other AI-related stocks showed varied performance. CoreWeave shares jumped 5% on news of its upcoming addition to the Nasdaq 100, yet Adobe plummeted nearly 7% following the announcement of its CFO's departure and ongoing CEO search. Analysts remain divided on whether recent volatility in momentum stocks signals a healthy consolidation or a deeper shift back to historical market norms.",
    sources: [
      { title: "CoreWeave jumps 5% on Nasdaq 100 inclusion", url: "https://www.cnbc.com/tech/coreweave-nasdaq-100" },
      { title: "Adobe falls 7% as CFO departs amid CEO search", url: "https://www.reuters.com/technology/adobe-cfo-departure" },
      { title: "Momentum stocks face consolidation, analysts split", url: "https://www.wsj.com/markets/tech-momentum-stocks" },
    ],
  },
  {
    headline: "Federal Reserve maintains steady rate stance under new leadership",
    body:
      "Heading into the June 16-17 FOMC meeting, the first to be chaired by Kevin Warsh, market probability for a rate hold remains near 100%. Recent strong labor data and persistent energy-driven inflation have led major financial institutions to push back their expectations for interest rate cuts into 2027. The current target federal funds rate of 3.50% to 3.75% is expected to remain stable for the remainder of 2026 as the central bank maintains a data-dependent approach.",
    sources: [
      { title: "Fed to hold rates this year, cut calls fade as war inflation lingers", url: "https://www.reuters.com/markets/us/fed-rate-hold" },
      { title: "Fed Decision in June? Trading Odds & Predictions 2026", url: "https://polymarket.com/event/fed-decision-june-2026" },
      { title: "Why the Fed Is Unlikely to Cut Rates This Year", url: "https://www.goldmansachs.com/insights/fed-rate-outlook" },
      { title: "Warsh chairs first FOMC meeting amid steady-rate consensus", url: "https://www.bloomberg.com/markets/fomc-warsh" },
      { title: "Markets price near-100% odds of June rate hold", url: "https://www.cnbc.com/economy/fomc-june-hold" },
    ],
  },
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconOf(url: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostOf(url))}`;
}

function SourcesButton({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  const previews = sources.slice(0, 3);
  return (
    <Popover.Root>
      <Popover.Trigger
        className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.03] py-1 pl-1.5 pr-3 text-xs font-medium text-white/60 outline-none transition-colors hover:bg-white/[0.07] hover:text-white/85"
        aria-label={`${sources.length} sources`}
      >
        <span className="flex items-center">
          {previews.map((source, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={source.url}
              src={faviconOf(source.url)}
              alt=""
              className={cn(
                "h-5 w-5 rounded-full border border-[#0b0b10] bg-white/90 object-contain",
                i > 0 && "-ml-2"
              )}
              loading="lazy"
            />
          ))}
        </span>
        {sources.length} {sources.length === 1 ? "site" : "sites"}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-[180]">
          <Popover.Popup className="w-80 rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-popover-strong)] p-2 text-white shadow-[var(--shadow-popover)] outline-none">
            <p className="px-2 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
              Sources · {sources.length}
            </p>
            {/* Cap the visible height to ~3 rows; the rest scrolls within the popover. */}
            <div className="max-h-[15.75rem] overflow-y-auto">
            {sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.055]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={faviconOf(source.url)}
                  alt=""
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-white/90 object-contain"
                  loading="lazy"
                />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-medium leading-snug text-white/85">{source.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-white/40">{hostOf(source.url)}</span>
                </span>
              </a>
            ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SummaryRow({ story, isOpen, onToggle }: { story: SummaryStory; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <div className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex-1 text-left text-sm font-medium text-white/85"
        >
          {story.headline}
        </button>

        <SourcesButton sources={story.sources} />

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse" : "Expand"}
          className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.03] text-white/50 transition-colors duration-150 hover:bg-white/[0.07] hover:text-white/80"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-150 motion-reduce:transition-none", isOpen && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <div className="pb-4 pr-10">
          <p className="text-sm leading-relaxed text-white/55">{story.body}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
            Dive deeper on this topic with AI
          </button>
        </div>
      )}
    </div>
  );
}

export default function MarketSummary() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-2">
      {STORIES.map((story, index) => (
        <SummaryRow
          key={story.headline}
          story={story}
          isOpen={openIndex === index}
          onToggle={() => setOpenIndex((prev) => (prev === index ? null : index))}
        />
      ))}
    </div>
  );
}
