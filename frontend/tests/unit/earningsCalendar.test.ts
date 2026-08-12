import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCalendarDays,
  buildEarningsEvents,
  buildEarningsEventsFromCalendar,
  buildMonthGrid,
  filterEarningsEvents,
  marketCapTier,
  parseDateKey,
} from "../../src/lib/earnings-calendar.ts";
import type { MarketQuote } from "../../src/lib/api.ts";

const quote: MarketQuote = {
  ticker: "NVDA",
  name: "NVIDIA Corp.",
  exchange: "Nasdaq",
  price: 180,
  change: 1.2,
  currency: "USD",
  market_cap: 4_000_000_000_000,
  history: [],
  earnings: [
    { date: "2026-08-26", session: "post", eps_actual: null, eps_estimate: 1.11, beat_pct: null, revenue_actual: null, revenue_estimate: 45_000_000_000, revenue_beat_pct: null },
  ],
};

test("normalizes quote earnings and portfolio relevance", () => {
  const events = buildEarningsEvents([quote], ["NVDA"], []);
  assert.equal(events.length, 1);
  assert.equal(events[0].country, "US");
  assert.equal(events[0].marketCapTier, "mega");
  assert.equal(events[0].session, "post");
  assert.equal(events[0].isHolding, true);
  assert.equal(events[0].isWatchlist, false);
});

test("builds provider-backed calendar events with quote logo metadata", () => {
  const events = buildEarningsEventsFromCalendar([{
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    date: "2026-08-26",
    session: "post",
    country: "US",
    market_cap: 4_000_000_000_000,
    logo_url: "https://static.example/nvda.png",
    eps_actual: null,
    eps_estimate: 1.11,
    beat_pct: null,
    revenue_actual: null,
    revenue_estimate: 45_000_000_000,
    revenue_beat_pct: null,
  }], ["NVDA"], [], [quote]);

  assert.equal(events[0].logoUrl, "https://static.example/nvda.png");
  assert.equal(events[0].isHolding, true);
  assert.equal(events[0].point.eps_estimate, 1.11);
});

test("builds stable day and six-week month ranges", () => {
  const events = buildEarningsEvents([quote]);
  const days = buildCalendarDays(parseDateKey("2026-08-25"), 3, events);
  assert.deepEqual(days.map((day) => day.date), ["2026-08-25", "2026-08-26", "2026-08-27"]);
  assert.equal(days[1].events[0].symbol, "NVDA");
  const month = buildMonthGrid(parseDateKey("2026-08-11"));
  assert.equal(month.length, 42);
  assert.equal(month[0], "2026-07-26");
  assert.equal(month.at(-1), "2026-09-05");
});

test("filters by scope, country, and minimum market cap", () => {
  const events = buildEarningsEvents([quote], ["NVDA"], []);
  assert.equal(filterEarningsEvents(events, { holdingsOnly: true, country: "US", minimumMarketCap: "large" }).length, 1);
  assert.equal(filterEarningsEvents(events, { watchlistOnly: true }).length, 0);
  assert.equal(filterEarningsEvents(events, { country: "CA" }).length, 0);
  assert.equal(marketCapTier(1_500_000_000), "mid");
});
