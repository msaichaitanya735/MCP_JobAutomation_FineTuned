import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RunCard } from "@/components/run-card";
import { RunsStats } from "@/components/runs-stats";
import { loadAllSampleRuns } from "@/lib/runs";

export const metadata = {
  title: "runs — agentic resume pipeline",
  description: "Curated public runs of the resume tailoring pipeline.",
};

export default async function RunsPage() {
  const runs = await loadAllSampleRuns();

  return (
    <>
      <SiteHeader />
      <main className="container py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">
              runs
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A curated set of pipeline runs. Each one is a real{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">RunRecord</code>{" "}
              from the JSONL log, redacted where needed and committed to{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                frontend/data/sample-runs/
              </code>
              .
            </p>
          </div>
          <Link
            href="/submit"
            className="font-mono text-xs text-primary underline underline-offset-2"
          >
            submit your own jd →
          </Link>
        </header>

        {runs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            <RunsStats runs={runs} />
            <ul className="grid gap-3 md:grid-cols-2">
              {runs.map((run) => (
                <li key={run.run_id}>
                  <RunCard run={run} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed py-16 text-center">
      <FileQuestion className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 font-mono text-base font-semibold">no sample runs yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Drop one or more redacted{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">RunRecord</code> JSON
        files into{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          frontend/data/sample-runs/
        </code>{" "}
        and they will appear here on the next request. Use{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          job-pipeline export-runs
        </code>{" "}
        once that helper lands.
      </p>
    </div>
  );
}
