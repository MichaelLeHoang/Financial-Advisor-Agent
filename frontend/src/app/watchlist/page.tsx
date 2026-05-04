"use client";

import { useEffect, useState } from "react";
import { Plus, Star } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { Watchlist } from "@/lib/api";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";

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
        </div>
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}

        <Card className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28)]">
          <CardContent className="flex gap-3 p-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 flex-1 rounded-xl border-transparent bg-transparent px-4 text-sm text-white placeholder:text-white/24 focus-visible:ring-0"
            placeholder="Watchlist name"
          />
          <Button
            onClick={create}
            disabled={loading}
            className="h-11 gap-2 rounded-xl bg-indigo-primary px-4 text-sm font-semibold text-white hover:bg-indigo-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create
          </Button>
          </CardContent>
        </Card>

        {watchlists.length === 0 ? (
          <Empty>
            <Star className="mb-4 h-6 w-6 text-indigo-primary" />
            <EmptyTitle>No symbols yet</EmptyTitle>
            <EmptyDescription>Add a watchlist to start tracking markets.</EmptyDescription>
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {watchlists.map((watchlist) => (
              <Card key={watchlist.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28)]">
                <CardContent className="p-5">
                  <Star className="mb-4 h-5 w-5 text-indigo-primary" />
                  <div className="font-semibold">{watchlist.name}</div>
                  <div className="mt-1 text-xs text-white/35">{watchlist.id}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
