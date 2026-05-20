import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EligibilityVerdict } from "@/lib/types";

export function EligibilityCard({ verdict }: { verdict: EligibilityVerdict }) {
  const flags: { label: string; ok: boolean; goodWhenTrue: boolean }[] = [
    { label: "hard_block", ok: verdict.hard_block, goodWhenTrue: false },
    { label: "soft_block", ok: verdict.soft_block, goodWhenTrue: false },
    { label: "fit_ok", ok: verdict.fit_ok, goodWhenTrue: true },
    { label: "worth_it", ok: verdict.worth_it, goodWhenTrue: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>eligibility_verdict</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {flags.map((f) => {
            const isGood = f.goodWhenTrue ? f.ok : !f.ok;
            const Icon = isGood ? CheckCircle2 : XCircle;
            return (
              <div
                key={f.label}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs",
                  isGood
                    ? "border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                )}
              >
                <Icon className="size-3.5" />
                <span>{f.label}</span>
                <span className="ml-auto opacity-70">{String(f.ok)}</span>
              </div>
            );
          })}
        </div>

        <div className="space-y-1">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            reason
          </h3>
          <p className="font-mono text-sm">{verdict.reason}</p>
        </div>
        <div className="space-y-1">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            explanation
          </h3>
          <p className="text-sm leading-relaxed">{verdict.explanation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
