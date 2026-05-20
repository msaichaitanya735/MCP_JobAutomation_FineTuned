import Link from "next/link";
import { ArrowUpRight, Clock, Coins, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutcomeBadge } from "@/components/outcome-badge";
import { formatCost, formatLatency, formatTimestamp } from "@/lib/utils";
import type { RunRecord } from "@/lib/types";

export function RunCard({ run }: { run: RunRecord }) {
  return (
    <Link
      href={`/runs/${run.run_id}`}
      className="group block rounded-xl outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card className="transition-colors group-hover:border-primary/40 group-hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {run.role_title ?? "(unknown role)"}
              </CardTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {run.company ?? "(unknown company)"} · {formatTimestamp(run.timestamp)}
              </p>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <OutcomeBadge outcome={run.outcome} />
            {run.skip_reason ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {run.skip_reason}
              </span>
            ) : null}
          </div>

          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {run.jd_excerpt}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 font-mono text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {formatLatency(run.total_latency_ms)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Cpu className="size-3" />
              {run.total_tokens_in + run.total_tokens_out} tok
            </span>
            <span className="inline-flex items-center gap-1">
              <Coins className="size-3" />
              {formatCost(run.total_cost_usd)}
            </span>
            {run.ats_score ? (
              <span>
                ATS {(run.ats_score.overall_score * 100).toFixed(0)}%
              </span>
            ) : null}
            <span className="ml-auto text-[10px] uppercase tracking-wider">
              {run.run_id}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
