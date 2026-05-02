"use client";

import { useState } from "react";
import { RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "motion/react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface StockInfo {
    ticker: string;
    name: string;
    price: string;
    change: string;
    up: boolean;
    data: number[];
    loading?: boolean;
}

const DEFAULT_STOCKS: StockInfo[] = [
    { ticker: "AAPL", name: "Apple Inc.", price: "—", change: "—", up: true, data: [40, 45, 42, 48, 46, 50, 55] },
    { ticker: "NVDA", name: "NVIDIA Corp.", price: "—", change: "—", up: true, data: [30, 40, 35, 50, 60, 55, 70] },
    { ticker: "GOOGL", name: "Alphabet Inc.", price: "—", change: "—", up: false, data: [50, 48, 49, 45, 46, 44, 42] },
    { ticker: "MSFT", name: "Microsoft", price: "—", change: "—", up: true, data: [40, 41, 40, 42, 41, 43, 44] },
    { ticker: "TSLA", name: "Tesla, Inc.", price: "—", change: "—", up: false, data: [60, 55, 58, 50, 45, 48, 40] },
    { ticker: "AMZN", name: "Amazon.com", price: "—", change: "—", up: true, data: [35, 38, 36, 40, 42, 41, 45] },
    { ticker: "META", name: "Meta Platforms", price: "—", change: "—", up: true, data: [45, 46, 48, 47, 50, 52, 55] },
];

function parsePrice(text: string): { price: string; change: string; up: boolean } | null {
    const priceMatch = text.match(/Latest Close: \$([0-9.]+)/);
    const changeMatch = text.match(/Daily Change: ([+-]?[0-9.]+)%/);
    if (priceMatch) {
        const change = changeMatch ? parseFloat(changeMatch[1]) : 0;
        return {
            price: priceMatch[1],
            change: changeMatch ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—",
            up: change >= 0,
        };
    }
    return null;
}

export default function MarketPage() {
    const [stocks, setStocks] = useState<StockInfo[]>(DEFAULT_STOCKS);
    const [loading, setLoading] = useState(false);

    const refresh = async () => {
        setLoading(true);
        const updated = [...stocks];
        await Promise.all(
            updated.map(async (stock, i) => {
                try {
                    const res = await api.chat(
                        `Use the get_stock_info tool for ${stock.ticker}. Reply only with the raw tool output.`,
                        `market-${stock.ticker}`,
                        false
                    );
                    const parsed = parsePrice(res.response);
                    if (parsed) {
                        updated[i] = { ...stock, ...parsed };
                    }
                } catch {
                    /* keep default */
                }
            })
        );
        setStocks(updated);
        setLoading(false);
    };

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                    Market Overview
                </h1>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="glass glass-hover p-3 rounded-xl disabled:opacity-50"
                >
                    <RefreshCw className={cn("w-5 h-5 text-white/60", loading && "animate-spin")} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {stocks.map((stock) => (
                    <motion.div
                        key={stock.ticker}
                        whileHover={{ y: -5 }}
                        className="glass glass-hover p-6 rounded-3xl group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-white">{stock.ticker}</h3>
                                <p className="text-white/40 text-sm">{stock.name}</p>
                            </div>
                            <div
                                className={cn(
                                    "px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold",
                                    stock.up ? "bg-green-positive/20 text-green-positive" : "bg-red-negative/20 text-red-negative"
                                )}
                            >
                                {stock.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {stock.change}
                            </div>
                        </div>

                        <div className="text-3xl font-bold mb-6">${stock.price}</div>

                        <div className="h-20 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stock.data.map((v, i) => ({ v, i }))}>
                                    <defs>
                                        <linearGradient id={`grad-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={stock.up ? "#34d399" : "#f87171"} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={stock.up ? "#34d399" : "#f87171"} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area
                                        type="monotone"
                                        dataKey="v"
                                        stroke={stock.up ? "#34d399" : "#f87171"}
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill={`url(#grad-${stock.ticker})`}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
