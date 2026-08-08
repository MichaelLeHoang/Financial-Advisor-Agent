import { redirect } from "next/navigation";

export default async function TradingViewStockGateway({ searchParams }: { searchParams: Promise<{ tvwidgetsymbol?: string }> }) {
  const { tvwidgetsymbol = "NASDAQ:AAPL" } = await searchParams;
  const [exchange, rawSymbol] = decodeURIComponent(tvwidgetsymbol).split(":");
  const symbol = (rawSymbol || exchange || "AAPL").toUpperCase().replace(/[^A-Z0-9.-]/g, "") || "AAPL";
  const venue = rawSymbol ? exchange.toUpperCase().replace(/[^A-Z]/g, "") : "NASDAQ";
  redirect(`/discover/markets/stocks/${encodeURIComponent(symbol)}?exchange=${encodeURIComponent(venue)}`);
}
