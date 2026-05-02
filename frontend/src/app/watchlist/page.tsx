"use client";

import { useEffect, useState } from "react";
import { Plus, Star } from "lucide-react";
import FinanceDisclaimer from "@/components/common/FinanceDisclaimer";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { Watchlist } from "@/lib/api";
import UpgradePrompt from "@/components/common/UpgradePrompt";

export default function WatchlistPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [name, setName] = useState("Primary Watchlist");
  const [loading, setLoading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const refresh = async () => setWatchlists(await api.watchlists());

  useEffect(() => {
    void refresh();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setUpgradeMessage(null);
    try {
      await api.createWatchlist(name.trim());
      setName("");
      await refresh();
    } catch (error) {
      if (isUpgradeRequiredError(error)) setUpgradeMessage(error.detail.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Watchlists</h1>
          <p className="mt-2 text-white/42">Track the symbols you want to follow.</p>
        </div>
        <FinanceDisclaimer />
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}

        <div className="flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-white/24"
            placeholder="Watchlist name"
          />
          <button
            onClick={create}
            disabled={loading}
            className="flex h-11 items-center gap-2 rounded-xl bg-indigo-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {watchlists.map((watchlist) => (
            <div key={watchlist.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-5">
              <Star className="mb-4 h-5 w-5 text-indigo-primary" />
              <div className="font-semibold">{watchlist.name}</div>
              <div className="mt-1 text-xs text-white/35">{watchlist.id}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
