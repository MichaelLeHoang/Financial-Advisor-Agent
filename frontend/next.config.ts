import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

loadEnvConfig(path.resolve(process.cwd(), ".."));

const publicEnv = Object.fromEntries(
  [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_E2E_AUTH",
  ]
    .map((key) => [key, process.env[key]])
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
);

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  env: publicEnv,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/home", permanent: false },
      { source: "/discover", destination: "/discover/markets", permanent: false },
      { source: "/research", destination: "/invest/research", permanent: false },
      { source: "/research/:runId", destination: "/invest/research/:runId", permanent: false },
      { source: "/backtest", destination: "/trade/strategies", permanent: false },
      { source: "/backtest/sessions", destination: "/trade/strategies/sessions", permanent: false },
      { source: "/backtest/runs/:id", destination: "/trade/strategies/runs/:id", permanent: false },
      { source: "/backtest/replay/:id", destination: "/trade/strategies/replay/:id", permanent: false },
      { source: "/market", destination: "/discover/markets", permanent: false },
      { source: "/watchlist", destination: "/discover/watchlists", permanent: false },
      { source: "/risk", destination: "/portfolio/risk", permanent: false },
      { source: "/signals", destination: "/discover/screeners", permanent: false },
      { source: "/news", has: [{ type: "query", key: "tab", value: "picks" }], destination: "/discover/picks", permanent: false },
      { source: "/news", has: [{ type: "query", key: "tab", value: "reports" }], destination: "/discover/reports", permanent: false },
      { source: "/news", destination: "/discover/news", permanent: false },
      { source: "/trade/desk", destination: "/trade", permanent: false },
      { source: "/session", destination: "/ai", permanent: false },
      { source: "/session/:sessionId", destination: "/ai/:sessionId", permanent: false },
    ];
  },
};

export default nextConfig;
