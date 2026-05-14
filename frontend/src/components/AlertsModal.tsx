"use client";

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Bell, MessageSquare, Radio, Send } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { Alert, AlertEvent, NotificationChannel } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 };

export default function AlertsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [alertName, setAlertName] = useState("Price condition");
  const [symbol, setSymbol] = useState("AAPL");
  const [operator, setOperator] = useState<"above" | "below">("above");
  const [price, setPrice] = useState(200);
  const [channelType, setChannelType] = useState("in_app");
  const [channelName, setChannelName] = useState("In-app alerts");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const canUseAlerts = PLAN_RANK[user.plan] >= PLAN_RANK.trader;

  useEffect(() => {
    if (!isOpen || !canUseAlerts) return;
    void refresh();
  }, [isOpen, canUseAlerts]);

  const refresh = async () => {
    try {
      const [alertRows, eventRows, channelRows] = await Promise.all([
        api.alerts(),
        api.alertEvents(),
        api.notificationChannels(),
      ]);
      setAlerts(alertRows);
      setEvents(eventRows);
      setChannels(channelRows);
    } catch {
      setAlerts([]);
      setEvents([]);
      setChannels([]);
    }
  };

  const createChannel = async () => {
    setLoading(true);
    setMessage(null);
    setUpgradeMessage(null);
    try {
      await api.createNotificationChannel({
        channel_type: channelType,
        name: channelName,
        destination: destination || null,
        config: channelType === "discord_webhook" ? { webhook_url: destination } : {},
      });
      setDestination("");
      setMessage("Notification channel saved.");
      await refresh();
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setMessage(err instanceof Error ? err.message : "Unable to save channel.");
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    setLoading(true);
    setMessage(null);
    setUpgradeMessage(null);
    try {
      await api.createAlert({
        name: alertName,
        alert_type: "price",
        symbol,
        condition: { operator, price },
        channels: channels.map((channel) => channel.id),
      });
      setMessage("Alert created.");
      await refresh();
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setMessage(err instanceof Error ? err.message : "Unable to create alert.");
    } finally {
      setLoading(false);
    }
  };

  const evaluate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const stats = await api.evaluateAlerts();
      setMessage(`Evaluated ${stats.evaluated} alerts. Triggered ${stats.triggered}.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to evaluate alerts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl bg-[var(--surface-dialog)] text-[var(--text-primary)]">
        <DialogHeader className="border-b border-[var(--theme-border)] px-6 pb-5 pr-16">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <DialogTitle className="text-2xl">Alerts</DialogTitle>
              <DialogDescription>
                Track conditions and route neutral signal notifications to in-app, Telegram, or Discord channels.
              </DialogDescription>
            </div>
            {canUseAlerts && (
              <Button onClick={evaluate} disabled={loading} className="theme-solid-action h-10 rounded-xl px-4 text-sm font-semibold">
                <Radio className="mr-2 h-4 w-4" />
                Evaluate now
              </Button>
            )}
          </div>
        </DialogHeader>

        {!canUseAlerts ? (
          <div className="px-6 py-10">
            <div className="mx-auto max-w-lg text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)]">
                <Bell className="h-6 w-6 text-indigo-primary" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">Alerts are available on Trader</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Create signal and risk conditions, connect notification channels, and review triggered events.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
              {message && (
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  {message}
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-5">
                  <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Send className="h-4 w-4 text-indigo-primary" />
                        Notification channel
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="Channel name" className="h-11 rounded-xl" />
                        <select value={channelType} onChange={(event) => setChannelType(event.target.value)} className="h-11 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-sm text-[var(--text-primary)]">
                          <option value="in_app">In-app</option>
                          <option value="telegram">Telegram</option>
                          <option value="discord_webhook">Discord webhook</option>
                          <option value="email">Email placeholder</option>
                        </select>
                      </div>
                      <Input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Chat ID, email, or webhook URL" className="h-11 rounded-xl" />
                      <Button onClick={createChannel} disabled={loading} className="theme-solid-action h-10 rounded-xl px-4 text-sm font-semibold">
                        Save channel
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Bell className="h-4 w-4 text-indigo-primary" />
                        Price alert
                      </div>
                      <Input value={alertName} onChange={(event) => setAlertName(event.target.value)} placeholder="Alert name" className="h-11 rounded-xl" />
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="Symbol" className="h-11 rounded-xl" />
                        <select value={operator} onChange={(event) => setOperator(event.target.value as "above" | "below")} className="h-11 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-sm text-[var(--text-primary)]">
                          <option value="above">Above</option>
                          <option value="below">Below</option>
                        </select>
                        <Input type="number" value={price} onChange={(event) => setPrice(Number(event.target.value))} className="h-11 rounded-xl" />
                      </div>
                      <Button onClick={createAlert} disabled={loading} className="accent-gradient-surface on-accent h-11 rounded-xl px-4 text-sm font-semibold">
                        Create alert
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-5">
                  <Panel title="Active alerts" icon={AlertTriangle}>
                    {alerts.length === 0 ? (
                      <Empty text="No alerts yet." />
                    ) : (
                      <div className="space-y-2">
                        {alerts.map((alert) => (
                          <div key={alert.id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold">{alert.name}</div>
                              <span className={cn("rounded-lg px-2 py-1 text-xs font-semibold", alert.is_active ? "bg-green-positive/12 text-green-positive" : "bg-white/[0.06] text-[var(--text-muted)]")}>
                                {alert.is_active ? "Active" : "Paused"}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-[var(--text-muted)]">
                              {alert.symbol} {String(alert.condition.operator)} {String(alert.condition.price)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>

                  <Panel title="Channels" icon={MessageSquare}>
                    {channels.length === 0 ? (
                      <Empty text="No notification channels connected." />
                    ) : (
                      <div className="space-y-2">
                        {channels.map((channel) => (
                          <div key={channel.id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-4 py-3">
                            <div className="font-semibold">{channel.name}</div>
                            <div className="mt-1 text-sm text-[var(--text-muted)]">{formatChannel(channel.channel_type)} {channel.destination_label ? `· ${channel.destination_label}` : ""}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>

                  <Panel title="Event history" icon={Radio}>
                    {events.length === 0 ? (
                      <Empty text="Triggered events will appear here." />
                    ) : (
                      <div className="space-y-2">
                        {events.map((event) => (
                          <div key={event.id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-4 py-3">
                            <div className="text-sm font-semibold">{event.message}</div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">{new Date(event.created_at).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-indigo-primary" />
          {title}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-[var(--theme-border)] px-4 py-6 text-sm text-[var(--text-muted)]">{text}</div>;
}

function formatChannel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
