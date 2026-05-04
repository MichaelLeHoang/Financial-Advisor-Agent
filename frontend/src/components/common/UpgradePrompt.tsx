import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UpgradePrompt({
  title = "Upgrade required",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <Card className="gap-0 rounded-2xl border border-indigo-primary/25 bg-indigo-primary/10 py-0 text-white shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 rounded-t-2xl px-5 pb-0 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-primary/18 text-indigo-primary ring-1 ring-indigo-primary/25">
          <Sparkles className="h-4 w-4" />
        </div>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3">
        <p className="text-sm leading-relaxed text-white/58">{message}</p>
      </CardContent>
    </Card>
  );
}
