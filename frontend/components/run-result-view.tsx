/**
 * Inline view of a live RunRecord, used by the /submit page after a
 * successful submission. A trimmed version of the /runs/[id] page so the
 * user gets the immediate visceral feedback (graph + metrics + downloads)
 * without leaving the submit flow.
 *
 * If the backend persisted this run (and exposed it on /runs/:id), we
 * show a "permanent link" CTA so the user can bookmark / share.
 */

import Link from "next/link";
import { ArrowUpRight, Clock, Coins, Cpu, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutcomeBadge } from "@/components/outcome-badge";
import { PipelineGraph } from "@/components/pipeline-graph";
import { MetricsTable } from "@/components/metrics-table";
import { ATSCard } from "@/components/ats-card";
import { EligibilityCard } from "@/components/eligibility-card";
import { RunDownloads } from "@/components/run-downloads";
import { formatCost, formatLatency, formatNumber } from "@/lib/utils";
import type { RunRecord } from "@/lib/types";

interface Props {
  run: RunRecord;
  onReset: () => void;
  /** Whether the backend persisted this run (a permanent /runs/:id exists). */
  persisted?: boolean;
}

export function RunResultView({ run, onReset, persisted }: Props) {
  const tokensTotal = run.total_tokens_in + run.total_tokens_out;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <OutcomeBadge outcome={run.outcome} />
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {run.run_id}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {persisted ? (
                <Button asChild variant="outline" size="sm" className="gap-1">
                  <Link href={`/runs/${run.run_id}`}>
                    permanent link
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              ) : null}
              <Button onClick={onReset} variant="ghost" size="sm" className="gap-1">
                <Repeat className="size-3.5" />
                run another
              </Button>
            </div>
          </div>

          <CardTitle className="text-lg">
            {run.role_title ?? "(unknown role)"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {run.company ?? "(unknown company)"}
            {run.skip_reason ? (
              <>
                {" · "}
                <span className="font-mono">{run.skip_reason}</span>
              </>
            ) : null}
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {formatLatency(run.total_latency_ms)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Cpu className="size-3" />
              {formatNumber(tokensTotal)} tok
            </span>
            <span className="inline-flex items-center gap-1">
              <Coins className="size-3" />
              {formatCost(run.total_cost_usd)}
            </span>
          </div>

          {run.outcome === "applied" ? (
            <RunDownloads
              pdfPath={run.rendered_pdf_path}
              docxPath={run.rendered_docx_path}
            />
          ) : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>pipeline.trace</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[640px] border-t">
            <PipelineGraph
              mode="trace"
              pathTaken={run.path_taken}
              metrics={run.node_metrics}
              height={640}
            />
          </div>
        </CardContent>
      </Card>

      <MetricsTable metrics={run.node_metrics} />

      {run.eligibility_verdict ? (
        <EligibilityCard verdict={run.eligibility_verdict} />
      ) : null}

      {run.ats_score ? <ATSCard score={run.ats_score} /> : null}
    </div>
  );
}
