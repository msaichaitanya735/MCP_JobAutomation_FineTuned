import { Check, X } from "lucide-react";
import { cn, formatCost, formatLatency, formatNumber } from "@/lib/utils";
import type { NodeMetrics } from "@/lib/types";

interface Props {
  metrics: NodeMetrics[];
}

export function MetricsTable({ metrics }: Props) {
  const totals = metrics.reduce(
    (acc, m) => ({
      latency_ms: acc.latency_ms + m.latency_ms,
      tokens_in: acc.tokens_in + m.tokens_in,
      tokens_out: acc.tokens_out + m.tokens_out,
      cost_usd: acc.cost_usd + m.cost_usd,
    }),
    { latency_ms: 0, tokens_in: 0, tokens_out: 0, cost_usd: 0 }
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full font-mono text-xs">
        <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">node</th>
            <th className="px-3 py-2 text-right">latency</th>
            <th className="px-3 py-2 text-right">tok in</th>
            <th className="px-3 py-2 text-right">tok out</th>
            <th className="px-3 py-2 text-right">cost</th>
            <th className="px-3 py-2 text-left">model</th>
            <th className="px-3 py-2 text-center">ok</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {metrics.map((m, i) => (
            <tr key={`${m.node_name}-${i}`} className={cn(!m.success && "bg-destructive/5")}>
              <td className="px-3 py-2 font-medium">{m.node_name}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatLatency(m.latency_ms)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {m.tokens_in > 0 ? formatNumber(m.tokens_in) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {m.tokens_out > 0 ? formatNumber(m.tokens_out) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {m.cost_usd > 0 ? formatCost(m.cost_usd) : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{m.model ?? "—"}</td>
              <td className="px-3 py-2 text-center">
                {m.success ? (
                  <Check className="mx-auto size-3.5 text-emerald-600" />
                ) : (
                  <X className="mx-auto size-3.5 text-destructive" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/20 font-semibold">
          <tr>
            <td className="px-3 py-2">total</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatLatency(totals.latency_ms)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatNumber(totals.tokens_in)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatNumber(totals.tokens_out)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatCost(totals.cost_usd)}
            </td>
            <td className="px-3 py-2" colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
