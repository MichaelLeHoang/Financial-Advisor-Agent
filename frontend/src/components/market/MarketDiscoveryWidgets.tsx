"use client";

import TradingViewWidget, { TRADINGVIEW_SCRIPTS } from "./TradingViewWidget";

export default function MarketDiscoveryWidgets() {
  return (
    <section className="mb-8" aria-label="Market map and global overview">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <TradingViewWidget
          title="S&P 500 stock heatmap"
          scriptUrl={TRADINGVIEW_SCRIPTS.heatmap}
          height={540}
          config={{
            dataSource: "SPX500",
            blockSize: "market_cap_basic",
            blockColor: "change",
            grouping: "sector",
            locale: "en",
            symbolUrl: "/discover/markets/stocks",
            hasTopBar: true,
            isDataSetEnabled: true,
            isZoomEnabled: true,
            hasSymbolTooltip: true,
            isMonoSize: false,
          }}
        />
        <TradingViewWidget
          title="Global market overview"
          scriptUrl={TRADINGVIEW_SCRIPTS.marketOverview}
          height={540}
          config={{
            dateRange: "12M",
            showChart: true,
            locale: "en",
            largeChartUrl: "/discover/markets/stocks",
            tabs: [
              { title: "Indices", symbols: [{ s: "FOREXCOM:SPXUSD", d: "S&P 500" }, { s: "NASDAQ:NDX", d: "Nasdaq 100" }, { s: "TVC:DJI", d: "Dow 30" }] },
              { title: "Futures", symbols: [{ s: "CME_MINI:ES1!", d: "S&P 500" }, { s: "CME_MINI:NQ1!", d: "Nasdaq 100" }, { s: "COMEX:GC1!", d: "Gold" }] },
            ],
          }}
        />
      </div>
    </section>
  );
}
