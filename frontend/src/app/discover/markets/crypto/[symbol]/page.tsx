import { notFound } from "next/navigation";

import CryptoDetails from "./CryptoDetails";

const SUPPORTED_BASES = new Set(["BTC", "ETH", "LTC", "DOGE", "ADA"]);
const SUPPORTED_QUOTES = new Set(["CAD", "USD", "USDT"]);

export default async function CryptoDetailsPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = await params;
  const symbol = decodeURIComponent(rawSymbol).toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const [base, requestedQuote = "CAD"] = symbol.split("-");
  if (!SUPPORTED_BASES.has(base)) notFound();
  const quote = SUPPORTED_QUOTES.has(requestedQuote) ? requestedQuote as "CAD" | "USD" | "USDT" : "CAD";
  return <CryptoDetails base={base} initialQuote={quote} />;
}
