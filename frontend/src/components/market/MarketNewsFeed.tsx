"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { NewsArticle } from "@/lib/api";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function MarketNewsFeed({ limit = 8, title = "Market news" }: { limit?: number; title?: string | null }) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .news(["market"], limit)
      .then((response) => {
        if (!cancelled) setArticles(response.articles);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-4">
      {title && <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{title}</div>}
      <div className="space-y-1">
        {loading && <div className="py-6 text-center text-xs text-[var(--text-subtle)]">Loading…</div>}
        {!loading && articles.length === 0 && <div className="py-6 text-center text-xs text-[var(--text-subtle)]">No news available.</div>}
        {articles.map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--surface-card-hover)]"
          >
            {article.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.thumbnail} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            ) : null}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium leading-5 text-[var(--text-primary)]">{article.title}</p>
              <p className="mt-1 text-xs text-[var(--text-subtle)]">
                {article.publisher}
                {article.published_at ? ` · ${timeAgo(article.published_at)}` : ""}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
