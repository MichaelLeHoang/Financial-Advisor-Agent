import { Sparkles } from "lucide-react";

export default function UpgradePrompt({
  title = "Upgrade required",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-indigo-primary/25 bg-indigo-primary/10 p-5 text-white">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-primary/18 text-indigo-primary ring-1 ring-indigo-primary/25">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="font-semibold">{title}</div>
      </div>
      <p className="text-sm leading-relaxed text-white/58">{message}</p>
    </div>
  );
}
