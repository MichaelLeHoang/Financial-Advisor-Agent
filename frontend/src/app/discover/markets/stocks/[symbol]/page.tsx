import { notFound, redirect } from "next/navigation";
import StockDetails from "./StockDetails";
import { isCryptoSymbol, marketDetailsHref } from "@/lib/market-routes";

export default async function StockDetailsPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ exchange?: string }> }) {
  const [{ symbol: rawSymbol }, { exchange }] = await Promise.all([params, searchParams]);
  const symbol = decodeURIComponent(rawSymbol).toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
  if (!symbol) notFound();
  if (isCryptoSymbol(symbol)) {
    redirect(marketDetailsHref(symbol, "crypto"));
  }
  return <StockDetails symbol={symbol} exchange={exchange} />;
}
