import { Card, CardContent } from "@/components/ui/card";
import { formatCost, formatLatency, formatNumber } from "@/lib/utils";
import type { RunRecord } from "@/lib/types";

interface Props {
  runs: RunRecord[];
}

export function RunsStats({ runs }: Props) {
  if (runs.length === 0) return null;

  const totalCost = runs.reduce((sum, r) => sum + r.total_cost_usd, 0);
  const totalTokens = runs.reduce(
    (sum, r) => sum + r.total_tokens_in + r.total_tokens_out,
    0
  );
  const avgLatency =
    runs.reduce((sum, r) => sum + r.total_latency_ms, 0) / runs.length;
  const applied = runs.filter((r) => r.outcome === "applied").length;
  const skipped = runs.filter((r) => r.outcome.startsWith("skipped")).length;

  const items: { label: string; value: string }[] = [
    { label: "runs", value: String(runs.length) },
    { label: "applied", value: `${applied}/${runs.length}` },
    { label: "skipped", value: String(skipped) },
    { label: "avg latency", value: formatLatency(avgLatency) },
    { label: "total tokens", value: formatNumber(totalTokens) },
    { label: "total cost", value: formatCost(totalCost) },
  ];

  return (
    <Card className="bg-muted/30">
      <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-3 md:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="font-mono">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {item.label}
            </div>
            <div className="text-base font-semibold tabular-nums">{item.value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
