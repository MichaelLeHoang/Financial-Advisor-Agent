import { notFound } from "next/navigation";
import StockDetails from "./StockDetails";

export default async function StockDetailsPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ exchange?: string }> }) {
  const [{ symbol: rawSymbol }, { exchange }] = await Promise.all([params, searchParams]);
  const symbol = decodeURIComponent(rawSymbol).toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
  if (!symbol) notFound();
  return <StockDetails symbol={symbol} exchange={exchange} />;
}
