import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Coins, Cpu } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OutcomeBadge } from "@/components/outcome-badge";
import { PipelineGraph } from "@/components/pipeline-graph";
import { NodeLegend } from "@/components/legend";
import { MetricsTable } from "@/components/metrics-table";
import { JDAnalysisCard } from "@/components/jd-analysis-card";
import { EligibilityCard } from "@/components/eligibility-card";
import { ATSCard } from "@/components/ats-card";
import { SelectedStoriesCard } from "@/components/selected-stories-card";
import { JsonViewer } from "@/components/json-viewer";
import { RunDownloads } from "@/components/run-downloads";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCost, formatLatency, formatNumber, formatTimestamp } from "@/lib/utils";
import { loadAllSampleRuns, loadSampleRun } from "@/lib/runs";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Pre-render every sample run at build time so the viewer is fully static.
export async function generateStaticParams() {
  const runs = await loadAllSampleRuns();
  return runs.map((r) => ({ id: r.run_id }));
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const run = await loadSampleRun(id);
  if (!run) return { title: "run not found" };
  return {
    title: `${run.role_title ?? "run"} — ${run.company ?? "agentic resume pipeline"}`,
  };
}

export default async function RunDetailPage({ params }: PageProps) {
  const { id } = await params;
  const run = await loadSampleRun(id);
  if (!run) notFound();

  const tokensTotal = run.total_tokens_in + run.total_tokens_out;

  return (
    <>
      <SiteHeader />
      <main className="container py-8">
        <Link
          href="/runs"
          className="mb-6 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          back to runs
        </Link>

        <header className="mb-8 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <OutcomeBadge outcome={run.outcome} />
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {run.run_id} · {formatTimestamp(run.timestamp)}
            </span>
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {run.role_title ?? "(unknown role)"}
          </h1>
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
              {formatNumber(tokensTotal)} tok ({formatNumber(run.total_tokens_in)} in /{" "}
              {formatNumber(run.total_tokens_out)} out)
            </span>
            <span className="inline-flex items-center gap-1">
              <Coins className="size-3" />
              {formatCost(run.total_cost_usd)}
            </span>
            <span>path · {run.path_taken.join(" → ")}</span>
          </div>

          {run.outcome === "applied" ? (
            <div className="pt-2">
              <RunDownloads
                pdfPath={run.rendered_pdf_path}
                docxPath={run.rendered_docx_path}
              />
            </div>
          ) : null}
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_minmax(360px,1fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-end justify-between gap-3">
              <div>
                <CardTitle>pipeline.trace</CardTitle>
                <p className="text-xs text-muted-foreground">
                  nodes that ran for this run, with their measured cost.
                </p>
              </div>
              <div className="hidden md:block">
                <NodeLegend />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[760px] border-t">
                <PipelineGraph
                  mode="trace"
                  pathTaken={run.path_taken}
                  metrics={run.node_metrics}
                  height={760}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>jd_excerpt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {run.jd_excerpt}
                </p>
              </CardContent>
            </Card>

            <MetricsTable metrics={run.node_metrics} />
          </div>
        </section>

        <Separator className="my-10" />

        <Tabs defaultValue="jd" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="jd">jd_analysis</TabsTrigger>
            <TabsTrigger value="eligibility">eligibility</TabsTrigger>
            <TabsTrigger value="stories">selected_stories</TabsTrigger>
            <TabsTrigger value="ats">ats_score</TabsTrigger>
            <TabsTrigger value="raw">raw</TabsTrigger>
          </TabsList>

          <TabsContent value="jd">
            {run.jd_analysis ? (
              <JDAnalysisCard analysis={run.jd_analysis} />
            ) : (
              <EmptyTab label="jd_analysis was not produced for this run." />
            )}
          </TabsContent>

          <TabsContent value="eligibility">
            {run.eligibility_verdict ? (
              <EligibilityCard verdict={run.eligibility_verdict} />
            ) : (
              <EmptyTab label="ai_eligibility_and_fit did not run." />
            )}
          </TabsContent>

          <TabsContent value="stories">
            <SelectedStoriesCard stories={run.selected_stories ?? null} />
          </TabsContent>

          <TabsContent value="ats">
            {run.ats_score ? (
              <ATSCard score={run.ats_score} />
            ) : (
              <EmptyTab label="ats_score did not run." />
            )}
          </TabsContent>

          <TabsContent value="raw">
            <JsonViewer value={run} />
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <p className="font-mono text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
