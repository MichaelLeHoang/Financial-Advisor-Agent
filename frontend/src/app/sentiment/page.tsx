"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ComponentType, DragEvent } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  Clipboard,
  ClipboardList,
  FileText,
  Gauge,
  Loader2,
  Send,
  TableProperties,
  UploadCloud,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  Area,
  CartesianGrid,
  Cell,
  Line,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";

import { cn } from "@/lib/utils";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { MarketQuote, SentimentResult } from "@/lib/api";
import { fetchQuote } from "@/lib/quote-cache";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Textarea } from "@/components/ui/textarea";

type SourceKey = "bloomberg" | "twitter" | "reddit" | "sec" | "earnings" | "newswire";

interface HeadlineItem {
  id: string;
  text: string;
  source: SourceKey;
  createdAt: number;
}

interface EntityMatch {
  ticker: string;
  name: string;
}

interface EntityImpact {
  ticker: string;
  name: string;
  mentions: number;
  score: number;
}

const FINBERT_DOC_URL = "https://huggingface.co/ProsusAI/finbert";

const SOURCES: Array<{ key: SourceKey; label: string; weight: number; hint: string }> = [
  { key: "bloomberg", label: "Bloomberg", weight: 1.05, hint: "Institutional news" },
  { key: "twitter", label: "Twitter/X", weight: 0.72, hint: "Fast, noisy social tape" },
  { key: "reddit", label: "Reddit WSB", weight: 0.62, hint: "Retail chatter" },
  { key: "sec", label: "SEC Filing", weight: 1.22, hint: "Primary filing" },
  { key: "earnings", label: "Earnings Call", weight: 1.12, hint: "Management language" },
  { key: "newswire", label: "Newswire", weight: 1, hint: "General market news" },
];

const ENTITY_CATALOG: EntityMatch[] = [
  { ticker: "AAPL", name: "Apple" },
  { ticker: "MSFT", name: "Microsoft" },
  { ticker: "NVDA", name: "Nvidia" },
  { ticker: "TSLA", name: "Tesla" },
  { ticker: "GOOGL", name: "Alphabet" },
  { ticker: "AMZN", name: "Amazon" },
  { ticker: "META", name: "Meta" },
  { ticker: "NFLX", name: "Netflix" },
  { ticker: "AMD", name: "AMD" },
  { ticker: "INTC", name: "Intel" },
  { ticker: "JPM", name: "JPMorgan" },
  { ticker: "BAC", name: "Bank of America" },
  { ticker: "XOM", name: "Exxon Mobil" },
  { ticker: "SHOP", name: "Shopify" },
  { ticker: "SPY", name: "S&P 500 ETF" },
  { ticker: "QQQ", name: "Nasdaq 100 ETF" },
  { ticker: "BTC-USD", name: "Bitcoin" },
  { ticker: "ETH-USD", name: "Ethereum" },
];

const ASPECTS = [
  { key: "financial", label: "Financial Performance", terms: ["earnings", "revenue", "margin", "profit", "eps", "sales", "cash flow", "guidance"] },
  { key: "leadership", label: "Leadership / Management", terms: ["ceo", "cfo", "management", "board", "resign", "appoint", "layoff", "strategy"] },
  { key: "product", label: "Product Announcements", terms: ["launch", "iphone", "product", "chip", "ai", "model", "vehicle", "software", "platform"] },
  { key: "regulatory", label: "Regulatory / Legal", terms: ["sec", "lawsuit", "regulator", "antitrust", "fine", "probe", "recall", "compliance"] },
  { key: "esg", label: "ESG", terms: ["emissions", "climate", "governance", "labor", "safety", "diversity", "sustainability", "environment"] },
];

const POSITIVE_TERMS = ["beat", "beats", "surge", "soar", "strong", "record", "upgrade", "profit", "growth", "raise", "bullish", "win"];
const NEGATIVE_TERMS = ["miss", "falls", "drop", "lag", "weak", "downgrade", "loss", "probe", "lawsuit", "recall", "bearish", "cut"];
const PLACEHOLDERS = [
  "Paste a market headline, filing excerpt, or earnings-call sentence...",
  "Apple shares rise after stronger services revenue...",
  "Drag a CSV of headlines or call transcript snippets into this panel...",
];

const placeholderContainerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.015 } },
  exit: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
};

const letterVariants = {
  initial: { opacity: 0, filter: "blur(12px)", y: 10 },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { opacity: { duration: 0.25 }, filter: { duration: 0.4 }, y: { type: "spring" as const, stiffness: 80, damping: 20 } },
  },
  exit: {
    opacity: 0,
    filter: "blur(12px)",
    y: -10,
    transition: { opacity: { duration: 0.2 }, filter: { duration: 0.3 }, y: { type: "spring" as const, stiffness: 80, damping: 20 } },
  },
};

function getId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `headline-${Date.now()}-${Math.random()}`;
}

function sourceFor(key: SourceKey) {
  return SOURCES.find((source) => source.key === key) ?? SOURCES[SOURCES.length - 1];
}

function sentimentScore(item: SentimentResult["individual"][number]) {
  return (item.all_scores.positive ?? 0) - (item.all_scores.negative ?? 0);
}

function weightedScore(item: SentimentResult["individual"][number], source: SourceKey) {
  return Math.max(-1, Math.min(1, sentimentScore(item) * sourceFor(source).weight));
}

function quickGuess(text: string) {
  const lower = text.toLowerCase();
  const positive = POSITIVE_TERMS.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
  const negative = NEGATIVE_TERMS.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
  const score = Math.max(-1, Math.min(1, (positive - negative) / 3));
  const label = score > 0.15 ? "bullish" : score < -0.15 ? "bearish" : "neutral";
  return { score, label };
}

function extractEntities(text: string): EntityMatch[] {
  const normalized = text.toLowerCase();
  const tickerMatches = Array.from(text.matchAll(/\b[A-Z]{2,5}(?:-[A-Z]{3})?\b/g)).map((match) => match[0]);
  const matches = ENTITY_CATALOG.filter((entity) => {
    if (tickerMatches.includes(entity.ticker)) return true;
    return normalized.includes(entity.name.toLowerCase());
  });
  const customTickers = tickerMatches
    .filter((ticker) => !matches.some((entity) => entity.ticker === ticker))
    .map((ticker) => ({ ticker, name: ticker }));
  return [...matches, ...customTickers].slice(0, 8);
}

function parseImportedText(text: string) {
  const lines = text
    .split(/\r?\n|,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((line) => line.replace(/^"|"$/g, "").trim())
    .filter(Boolean);

  if (lines.length > 1) return lines.slice(0, 100);

  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((line) => line.trim())
    .filter((line) => line.length > 12)
    .slice(0, 100);
}

function findAspects(text: string) {
  const lower = text.toLowerCase();
  const matched = ASPECTS.filter((aspect) => aspect.terms.some((term) => lower.includes(term))).map((aspect) => aspect.key);
  return matched.length > 0 ? matched : ["narrative"];
}

function flsDetected(text: string) {
  return /\b(expect|expects|forecast|guidance|outlook|anticipate|will|plans?|target|next quarter|fy\d{2,4})\b/i.test(text);
}

export default function SentimentPage() {
  const [input, setInput] = useState("");
  const [source, setSource] = useState<SourceKey>("newswire");
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);
  const [result, setResult] = useState<SentimentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [esgLens, setEsgLens] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const currentGuess = useMemo(() => quickGuess(input), [input]);
  const currentEntities = useMemo(() => extractEntities(input), [input]);
  const allEntities = useMemo(() => {
    const seen = new Map<string, EntityMatch>();
    headlines.forEach((headline) => extractEntities(headline.text).forEach((entity) => seen.set(entity.ticker, entity)));
    return Array.from(seen.values());
  }, [headlines]);

  useEffect(() => {
    if (isActive || input) return;
    const interval = window.setInterval(() => {
      setShowPlaceholder(false);
      window.setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 350);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [isActive, input]);

  useEffect(() => {
    if (!selectedEntity && allEntities.length > 0) setSelectedEntity(allEntities[0].ticker);
  }, [allEntities, selectedEntity]);

  useEffect(() => {
    if (!selectedEntity || !result) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    fetchQuote(selectedEntity, "1mo", "1d")
      .then((data) => {
        if (!cancelled) setQuote(data);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [result, selectedEntity]);

  const handleInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${event.target.scrollHeight}px`;
  };

  const addHeadline = () => {
    const text = input.trim();
    if (!text) return;
    setHeadlines((prev) => {
      if (prev.some((item) => item.text === text)) return prev;
      return [...prev, { id: getId(), text, source, createdAt: Date.now() }];
    });
    setInput("");
    setResult(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const importTexts = (texts: string[], selectedSource = source) => {
    if (texts.length === 0) return;
    setHeadlines((prev) => {
      const existing = new Set(prev.map((item) => item.text));
      const next = texts
        .filter((text) => !existing.has(text))
        .map((text) => ({ id: getId(), text, source: selectedSource, createdAt: Date.now() }));
      return [...prev, ...next];
    });
    setResult(null);
    setMessage(`Imported ${texts.length} text item${texts.length !== 1 ? "s" : ""}.`);
  };

  const uploadHeadlines = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text().catch(() => "");
    importTexts(parseImportedText(text));
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text().catch(() => "");
    importTexts(parseImportedText(text));
  };

  const analyze = async () => {
    if (headlines.length === 0) return;
    setLoading(true);
    setUpgradeMessage(null);
    setMessage(null);
    try {
      setResult(await api.sentiment(headlines.map((headline) => headline.text)));
    } catch (error) {
      if (isUpgradeRequiredError(error)) setUpgradeMessage(error.detail.message);
      else setMessage(error instanceof Error ? error.message : "Unable to analyze sentiment.");
    } finally {
      setLoading(false);
    }
  };

  const copyJson = async () => {
    if (!result) return;
    const payload = {
      generated_at: new Date().toISOString(),
      model: "ProsusAI/finbert",
      headlines: headlines.map((headline, index) => ({
        text: headline.text,
        source: headline.source,
        entities: extractEntities(headline.text),
        sentiment: result.individual[index],
        weighted_score: result.individual[index] ? weightedScore(result.individual[index], headline.source) : null,
      })),
      market_mood: result.market_mood,
    };
    await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    setMessage("Copied JSON results to clipboard.");
  };

  const mood = result?.market_mood;
  const individual = result?.individual ?? [];
  const weightedScores = individual.map((item, index) => weightedScore(item, headlines[index]?.source ?? "newswire"));
  const aggregateScore = weightedScores.length > 0
    ? weightedScores.reduce((sum, value) => sum + value, 0) / weightedScores.length
    : mood?.bullish_score ?? 0;
  const gaugeAngle = ((aggregateScore + 1) / 2) * 180;

  const aspectData = useMemo(() => {
    if (!result) return [];
    const buckets = new Map<string, { label: string; scores: number[]; count: number }>();
    ASPECTS.forEach((aspect) => buckets.set(aspect.key, { label: aspect.label, scores: [], count: 0 }));
    buckets.set("narrative", { label: "Market Narrative", scores: [], count: 0 });

    headlines.forEach((headline, index) => {
      const score = weightedScores[index] ?? 0;
      findAspects(headline.text).forEach((aspectKey) => {
        const bucket = buckets.get(aspectKey);
        if (!bucket) return;
        bucket.scores.push(score);
        bucket.count += 1;
      });
    });

    return Array.from(buckets.values())
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({
        label: bucket.label,
        count: bucket.count,
        score: bucket.scores.reduce((sum, value) => sum + value, 0) / bucket.scores.length,
      }));
  }, [headlines, result, weightedScores]);

  const entityImpacts = useMemo<EntityImpact[]>(() => {
    if (!result) return [];
    const buckets = new Map<string, { entity: EntityMatch; scores: number[]; mentions: number }>();
    headlines.forEach((headline, index) => {
      extractEntities(headline.text).forEach((entity) => {
        const bucket = buckets.get(entity.ticker) ?? { entity, scores: [], mentions: 0 };
        bucket.mentions += 1;
        bucket.scores.push(weightedScores[index] ?? 0);
        buckets.set(entity.ticker, bucket);
      });
    });
    return Array.from(buckets.values()).map((bucket) => ({
      ticker: bucket.entity.ticker,
      name: bucket.entity.name,
      mentions: bucket.mentions,
      score: bucket.scores.reduce((sum, value) => sum + value, 0) / bucket.scores.length,
    }));
  }, [headlines, result, weightedScores]);

  const contradiction = useMemo(() => {
    const strongPositive = weightedScores.filter((score) => score > 0.45).length;
    const strongNegative = weightedScores.filter((score) => score < -0.45).length;
    const total = weightedScores.length || 1;
    return strongPositive / total >= 0.25 && strongNegative / total >= 0.25;
  }, [weightedScores]);

  const flsItems = useMemo(() => headlines.filter((headline) => flsDetected(headline.text)), [headlines]);
  const esgItems = useMemo(
    () => headlines.filter((headline) => findAspects(headline.text).includes("esg")),
    [headlines]
  );

  const overlayData = useMemo(() => {
    if (!quote || !result) return [];
    const history = quote.history.slice(-Math.max(8, Math.min(30, quote.history.length)));
    const relevantIndexes = headlines
      .map((headline, index) => ({ headline, index }))
      .filter(({ headline }) => !selectedEntity || extractEntities(headline.text).some((entity) => entity.ticker === selectedEntity))
      .map(({ index }) => index);
    const scores = (relevantIndexes.length > 0 ? relevantIndexes : headlines.map((_, index) => index))
      .map((index) => weightedScores[index] ?? 0);

    if (history.length === 0 || scores.length === 0) return [];
    return history.map((point, index) => {
      const sentimentIndex = Math.min(scores.length - 1, Math.floor((index / Math.max(history.length - 1, 1)) * scores.length));
      return {
        label: point.label,
        price: point.price,
        sentiment: scores[sentimentIndex],
      };
    });
  }, [headlines, quote, result, selectedEntity, weightedScores]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              <span className="gradient-highlight">Sentiment</span> Analysis
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
              Real-time financial text triage powered by{" "}
              <a href={FINBERT_DOC_URL} target="_blank" rel="noreferrer" className="font-semibold text-indigo-primary hover:text-indigo-200">
                FinBERT
              </a>
              . Batch headlines, earnings-call excerpts, filings, and social tape into one weighted signal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-white/[0.08] bg-white/[0.04] px-3 py-1 text-white/60">
              {headlines.length} queued
            </Badge>
            <Badge variant="outline" className="rounded-full border-white/[0.08] bg-white/[0.04] px-3 py-1 text-white/60">
              {allEntities.length} entities
            </Badge>
            <Button type="button" variant="outline" size="sm" onClick={() => setEsgLens((value) => !value)} className="rounded-xl">
              ESG lens {esgLens ? "on" : "off"}
            </Button>
          </div>
        </header>

        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {message && <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-sm text-white/55">{message}</div>}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_22rem]">
          <Card className="rounded-3xl border-white/[0.07] bg-white/[0.035] py-0">
            <CardContent className="p-0">
              <motion.div
                layout
                ref={wrapperRef}
                onClick={() => setIsActive(true)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className="overflow-hidden rounded-3xl border p-2 text-white transition-colors"
                animate={{
                  borderColor: isDragging ? "rgba(99,102,241,0.75)" : isActive || input ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                  backgroundColor: isDragging ? "rgba(99,102,241,0.10)" : isActive || input ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.02)",
                  boxShadow: isActive || input || isDragging ? "0 8px 32px rgba(0,0,0,0.25)" : "var(--shadow-accent-composer)",
                }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="relative min-h-28 flex-1">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={handleInput}
                      onFocus={() => setIsActive(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          addHeadline();
                        }
                      }}
                      rows={3}
                      className="relative z-10 max-h-[220px] min-h-28 resize-none border-transparent bg-transparent px-3 py-3 pr-4 text-sm leading-6 text-white focus-visible:border-transparent focus-visible:ring-0"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-start px-3 py-3">
                      <AnimatePresence mode="wait">
                        {showPlaceholder && !isActive && !input && (
                          <motion.span
                            key={placeholderIndex}
                            className="mt-0.5 max-w-full select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm text-white/24"
                            variants={placeholderContainerVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                          >
                            {PLACEHOLDERS[placeholderIndex].split("").map((char, index) => (
                              <motion.span key={index} variants={letterVariants} style={{ display: "inline-block" }}>
                                {char === " " ? "\u00A0" : char}
                              </motion.span>
                            ))}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-row gap-2 sm:w-44 sm:flex-col">
                    <select
                      value={source}
                      onChange={(event) => setSource(event.target.value as SourceKey)}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.045] px-3 text-sm font-medium text-white outline-none focus:border-indigo-primary/50 sm:flex-none"
                      aria-label="Source weighting"
                    >
                      {SOURCES.map((item) => (
                        <option key={item.key} value={item.key} className="bg-slate-950 text-white">
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <Button type="button" onClick={addHeadline} className="theme-solid-action h-11 rounded-xl px-4 text-sm font-semibold">
                      <Send className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {(isActive || input || headlines.length > 0 || isDragging) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, filter: "blur(8px)" }}
                      animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                      exit={{ opacity: 0, height: 0, filter: "blur(8px)" }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 grid gap-3 border-t border-white/[0.06] px-2 pt-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                        <div className="flex flex-wrap items-center gap-2">
                          <UploadPill icon={FileText} label="TXT/MD" accept=".txt,.md" onChange={uploadHeadlines} />
                          <UploadPill icon={TableProperties} label="CSV" accept=".csv,.txt" onChange={uploadHeadlines} />
                          <UploadPill icon={ClipboardList} label="Batch" accept=".csv,.txt,.md" onChange={uploadHeadlines} />
                          <div className={cn(
                            "flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors",
                            currentGuess.label === "bullish" && "border-green-positive/25 bg-green-positive/10 text-green-positive",
                            currentGuess.label === "bearish" && "border-red-negative/25 bg-red-negative/10 text-red-negative",
                            currentGuess.label === "neutral" && "border-white/[0.08] bg-white/[0.035] text-white/45"
                          )}>
                            <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
                            Live read: {currentGuess.label} {currentGuess.score > 0 ? "+" : ""}{currentGuess.score.toFixed(2)}
                          </div>
                        </div>
                        <div className={cn(
                          "flex min-h-16 items-center justify-center rounded-2xl border border-dashed px-3 text-center text-xs transition-colors",
                          isDragging ? "border-indigo-primary/60 bg-indigo-primary/10 text-indigo-100" : "border-white/[0.09] bg-white/[0.025] text-white/35"
                        )}>
                          <UploadCloud className="mr-2 h-4 w-4" />
                          Drag CSV or transcript excerpts here
                        </div>
                      </div>

                      {currentEntities.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 px-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-white/30">Entities</span>
                          {currentEntities.map((entity) => (
                            <span key={entity.ticker} className="rounded-full bg-indigo-primary/15 px-2.5 py-1 text-xs font-semibold text-indigo-100 ring-1 ring-indigo-primary/20">
                              {entity.name} · {entity.ticker}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/[0.07] bg-white/[0.035]">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-indigo-primary" />
                <div>
                  <p className="font-semibold text-white">FinBERT model path</p>
                  <p className="text-xs text-white/38">Financial sentiment classification: positive, negative, neutral.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-xs leading-5 text-white/45">
                Source weighting adjusts the dashboard signal only; the backend model still receives the original text unchanged.
              </div>
              <a href={FINBERT_DOC_URL} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-indigo-primary hover:text-indigo-200">
                FinBERT documentation
              </a>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">Analysis queue</h2>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setHeadlines([]); setResult(null); }} disabled={headlines.length === 0} className="rounded-xl">
                Clear
              </Button>
              <Button
                onClick={analyze}
                disabled={headlines.length === 0 || loading}
                className="on-accent accent-gradient-surface h-10 rounded-xl px-4 text-sm font-bold shadow-[var(--shadow-primary-action)]"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : `Analyze ${headlines.length} headline${headlines.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
          {headlines.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-white/35">
              Add headlines or drag in a CSV to begin.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {headlines.map((headline) => (
                <div key={headline.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm leading-5 text-white/78">{headline.text}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setHeadlines((prev) => prev.filter((item) => item.id !== headline.id));
                        setResult(null);
                      }}
                      className="text-white/30 hover:text-red-negative"
                      aria-label="Remove headline"
                    >
                      <img src="/close-svgrepo-com.svg" alt="" aria-hidden="true" className="h-4 w-4 opacity-70" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-white/[0.06] bg-white/[0.035] text-white/45">{sourceFor(headline.source).label}</Badge>
                    {extractEntities(headline.text).slice(0, 3).map((entity) => (
                      <Badge key={entity.ticker} variant="outline" className="rounded-full border-indigo-primary/20 bg-indigo-primary/10 text-indigo-100">{entity.ticker}</Badge>
                    ))}
                    {flsDetected(headline.text) && <Badge variant="outline" className="rounded-full border-amber-warning/20 bg-amber-warning/10 text-amber-warning">FLS</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {mood && (
          <section className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
              <SentimentGauge score={aggregateScore} angle={gaugeAngle} signal={mood.signal} breakdown={mood.breakdown} />

              <Card className="rounded-3xl border-white/[0.07] bg-white/[0.035]">
                <CardContent className="space-y-5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-white">Aspect-based breakdown</h2>
                      <p className="mt-1 text-xs text-white/38">Weighted by source credibility and FinBERT class probabilities.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={copyJson} className="rounded-xl">
                        <Clipboard className="h-4 w-4" />
                        Copy JSON
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setMessage("Alert rule staged: notify when aggregate score drops below -0.50.")} className="rounded-xl">
                        <Bell className="h-4 w-4" />
                        Set alert
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(esgLens ? aspectData.filter((item) => item.label === "ESG") : aspectData).map((aspect) => (
                      <AspectRow key={aspect.label} label={aspect.label} count={aspect.count} score={aspect.score} />
                    ))}
                    {esgLens && esgItems.length === 0 && (
                      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm text-white/40">
                        No ESG-specific terms were detected in this batch.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {(contradiction || flsItems.length > 0) && (
              <div className="grid gap-4 lg:grid-cols-2">
                {contradiction && (
                  <div className="rounded-3xl border border-amber-warning/20 bg-amber-warning/10 p-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-warning" />
                      <div>
                        <p className="font-semibold text-amber-warning">Contradictory signal detected</p>
                        <p className="mt-1 text-sm leading-6 text-white/55">
                          This batch contains meaningful clusters of both strongly bullish and strongly bearish headlines. Treat it as a volatility warning, not a clean directional signal.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {flsItems.length > 0 && (
                  <div className="rounded-3xl border border-indigo-primary/20 bg-indigo-primary/10 p-5">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 text-indigo-primary" />
                      <div>
                        <p className="font-semibold text-indigo-100">Forward-looking statements isolated</p>
                        <p className="mt-1 text-sm leading-6 text-white/55">
                          {flsItems.length} queued item{flsItems.length !== 1 ? "s" : ""} contain guidance, outlook, forecast, or target language.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              <EntityMatrix data={entityImpacts} />
              <TimeSeriesOverlay
                entities={entityImpacts}
                selectedEntity={selectedEntity}
                onSelectEntity={setSelectedEntity}
                data={overlayData}
                quoteLoading={quoteLoading}
              />
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">Headline results</h2>
              <div className="grid gap-3">
                {individual.map((item, index) => {
                  const score = weightedScores[index] ?? 0;
                  return (
                    <div key={`${headlines[index]?.id ?? index}`} className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm leading-6 text-white/78">{headlines[index]?.text}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge className={cn(
                            "rounded-full px-3 py-1 text-xs uppercase",
                            item.label === "positive" && "bg-green-positive/15 text-green-positive",
                            item.label === "negative" && "bg-red-negative/15 text-red-negative",
                            item.label === "neutral" && "bg-white/[0.08] text-white/45"
                          )}>
                            {item.label} {(item.score * 100).toFixed(0)}%
                          </Badge>
                          <span className={cn("text-xs tabular-nums", score > 0 ? "text-green-positive" : score < 0 ? "text-red-negative" : "text-white/40")}>
                            weighted {score > 0 ? "+" : ""}{score.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function UploadPill({
  icon: Icon,
  label,
  accept,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  accept: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="group flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 text-xs font-medium text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-white/[0.075] hover:text-white">
      <Icon className="h-4 w-4 text-white/38 group-hover:text-indigo-primary" />
      <span>{label}</span>
      <input type="file" accept={accept} className="sr-only" onChange={onChange} />
    </label>
  );
}

function SentimentGauge({
  score,
  angle,
  signal,
  breakdown,
}: {
  score: number;
  angle: number;
  signal: string;
  breakdown: Record<string, number>;
}) {
  const color = score > 0.1 ? "var(--color-green-positive)" : score < -0.1 ? "var(--color-red-negative)" : "var(--color-amber-warning)";

  return (
    <Card className="rounded-3xl border-white/[0.07] bg-white/[0.035]">
      <CardContent className="flex flex-col items-center p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Gauge className="h-5 w-5 text-indigo-primary" />
          Fear & Greed
        </div>
        <div className="relative h-36 w-72 max-w-full">
          <svg viewBox="0 0 220 120" className="h-full w-full">
            <defs>
              <linearGradient id="sentiment-gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--color-red-negative)" />
                <stop offset="50%" stopColor="var(--color-amber-warning)" />
                <stop offset="100%" stopColor="var(--color-green-positive)" />
              </linearGradient>
            </defs>
            <path d="M 25 105 A 85 85 0 0 1 195 105" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" strokeLinecap="round" />
            <path d="M 25 105 A 85 85 0 0 1 195 105" fill="none" stroke="url(#sentiment-gauge-grad)" strokeWidth="16" strokeLinecap="round" opacity="0.55" />
            <line
              x1="110"
              y1="105"
              x2={110 + 65 * Math.cos(Math.PI - (angle * Math.PI) / 180)}
              y2={105 - 65 * Math.sin((angle * Math.PI) / 180)}
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="110" cy="105" r="6" fill="white" />
          </svg>
        </div>
        <p className="text-4xl font-bold" style={{ color }}>{signal}</p>
        <p className="mt-1 text-sm tabular-nums text-white/42">{score > 0 ? "+" : ""}{score.toFixed(3)} weighted score</p>
        <div className="mt-6 grid w-full grid-cols-3 gap-3">
          {["positive", "neutral", "negative"].map((label) => (
            <div key={label} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-center">
              <p className="text-xl font-bold text-white">{breakdown[label] ?? 0}</p>
              <p className="mt-1 text-xs capitalize text-white/35">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AspectRow({ label, count, score }: { label: string; count: number; score: number }) {
  const width = Math.min(100, Math.abs(score) * 100);
  const tone = score > 0.08 ? "bg-green-positive" : score < -0.08 ? "bg-red-negative" : "bg-amber-warning";
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className="text-xs text-white/35">{count} mention{count !== 1 ? "s" : ""}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div className={cn("h-full rounded-full", tone)} style={{ width: `${width}%` }} />
        </div>
        <span className={cn("w-14 text-right text-xs tabular-nums", score > 0 ? "text-green-positive" : score < 0 ? "text-red-negative" : "text-white/40")}>
          {score > 0 ? "+" : ""}{score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function EntityMatrix({ data }: { data: EntityImpact[] }) {
  return (
    <Card className="rounded-3xl border-white/[0.07] bg-white/[0.035]">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-primary" />
          <div>
            <h2 className="text-base font-semibold text-white">Entity impact matrix</h2>
            <p className="text-xs text-white/38">Mentions vs weighted sentiment score.</p>
          </div>
        </div>
        {data.length === 0 ? (
          <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-white/[0.08] text-sm text-white/35">
            No recognized entities in this batch.
          </div>
        ) : (
          <ChartContainer config={{ score: { label: "Sentiment" } }} className="aspect-auto h-72 w-full" initialDimension={{ width: 520, height: 288 }}>
            <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
              <XAxis type="number" dataKey="mentions" name="Mentions" tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="number" dataKey="score" name="Sentiment" domain={[-1, 1]} tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.25)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]?.payload) return null;
                  const item = payload[0].payload as EntityImpact;
                  return (
                    <div className="rounded-xl border border-white/[0.08] bg-[#090b12] px-3 py-2 text-xs shadow-xl">
                      <p className="font-semibold text-white">{item.name} · {item.ticker}</p>
                      <p className="mt-1 text-white/55">{item.mentions} mentions · {item.score > 0 ? "+" : ""}{item.score.toFixed(2)}</p>
                    </div>
                  );
                }}
              />
              <Scatter data={data} dataKey="score">
                {data.map((item) => (
                  <Cell key={item.ticker} fill={item.score > 0.1 ? "var(--color-green-positive)" : item.score < -0.1 ? "var(--color-red-negative)" : "var(--color-amber-warning)"} />
                ))}
              </Scatter>
            </ScatterChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TimeSeriesOverlay({
  entities,
  selectedEntity,
  onSelectEntity,
  data,
  quoteLoading,
}: {
  entities: EntityImpact[];
  selectedEntity: string | null;
  onSelectEntity: (ticker: string) => void;
  data: Array<{ label: string; price: number; sentiment: number }>;
  quoteLoading: boolean;
}) {
  return (
    <Card className="rounded-3xl border-white/[0.07] bg-white/[0.035]">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Price / sentiment overlay</h2>
            <p className="text-xs text-white/38">Aligns batch sentiment progression with the latest quote history.</p>
          </div>
          {entities.length > 0 && (
            <select
              value={selectedEntity ?? entities[0].ticker}
              onChange={(event) => onSelectEntity(event.target.value)}
              className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.045] px-3 text-sm font-medium text-white outline-none"
            >
              {entities.map((entity) => (
                <option key={entity.ticker} value={entity.ticker} className="bg-slate-950 text-white">
                  {entity.ticker}
                </option>
              ))}
            </select>
          )}
        </div>
        {quoteLoading ? (
          <div className="flex h-72 items-center justify-center gap-2 text-sm text-white/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading quote overlay...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-white/[0.08] text-sm text-white/35">
            Add a recognizable ticker to enable the overlay.
          </div>
        ) : (
          <ChartContainer config={{ price: { label: "Price" }, sentiment: { label: "Sentiment" } }} className="aspect-auto h-72 w-full" initialDimension={{ width: 520, height: 288 }}>
            <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis yAxisId="price" orientation="right" tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
              <YAxis yAxisId="sentiment" domain={[-1, 1]} hide />
              <ChartTooltip cursor={{ stroke: "rgba(255,255,255,0.24)" }} />
              <Area yAxisId="sentiment" type="monotone" dataKey="sentiment" fill="rgba(99,102,241,0.14)" stroke="rgba(129,140,248,0.9)" strokeWidth={2} dot={false} />
              <Line yAxisId="price" type="monotone" dataKey="price" stroke="rgba(255,255,255,0.72)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
