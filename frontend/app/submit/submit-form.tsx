"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, ServerCrash, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RunResultView } from "@/components/run-result-view";
import type { RunRecord } from "@/lib/types";

type Phase =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; run: RunRecord; persisted: boolean }
  | { kind: "error"; message: string; code?: string };

const MAX_JD_LEN = 30_000;

export function SubmitForm() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [jdText, setJdText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jdText.trim()) return;
    setPhase({ kind: "running" });
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jd_text: jdText }),
      });

      if (res.status === 401) {
        startTransition(() => router.replace("/login?from=/submit"));
        return;
      }

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        setPhase({
          kind: "error",
          code: typeof json.error === "string" ? json.error : `http_${res.status}`,
          message:
            typeof json.detail === "string"
              ? json.detail
              : `Request failed (${res.status}).`,
        });
        return;
      }

      const run = json as unknown as RunRecord;
      const persisted = Boolean((json as { persisted?: boolean }).persisted);
      setPhase({ kind: "done", run, persisted });
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  }

  function reset() {
    setJdText("");
    setPhase({ kind: "idle" });
  }

  if (phase.kind === "done") {
    return <RunResultView run={phase.run} onReset={reset} persisted={phase.persisted} />;
  }

  return (
    <div className="space-y-5">
      {phase.kind === "error" ? <ErrorAlert phase={phase} /> : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="jd">job_description</Label>
            <span className="font-mono text-[10px] text-muted-foreground">
              {jdText.length.toLocaleString()} / {MAX_JD_LEN.toLocaleString()} chars
            </span>
          </div>
          <Textarea
            id="jd"
            value={jdText}
            onChange={(e) => setJdText(e.target.value.slice(0, MAX_JD_LEN))}
            rows={18}
            placeholder="Paste the full job description text. The pipeline runs the same path you saw in the demo: hard_screen → ai_eligibility_and_fit → select_stories → compose_resume_content → resume_editor → pdf_converter → ats_score."
            disabled={phase.kind === "running"}
            spellCheck={false}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-muted-foreground">
            you are authenticated. each submission costs ~$0.01-0.05 in api spend.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={phase.kind === "running" || !jdText.length}
            >
              clear
            </Button>
            <Button
              type="submit"
              disabled={phase.kind === "running" || !jdText.trim()}
              className="gap-1.5"
            >
              {phase.kind === "running" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  running...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  run pipeline
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {phase.kind === "running" ? <RunningHint /> : null}
    </div>
  );
}

function RunningHint() {
  return (
    <Alert variant="info">
      <Loader2 className="size-4 animate-spin" />
      <AlertTitle>pipeline running</AlertTitle>
      <AlertDescription className="space-y-1 text-xs leading-relaxed">
        <p>
          The Lambda runs the full graph synchronously: hard_screen → eligibility
          (1 LLM call) → select_stories → compose_resume_content (1 LLM call) →
          resume_editor → pdf_converter → ats_score. Cold starts add ~2-5s.
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          a typical run takes 25-90 seconds.
        </p>
      </AlertDescription>
    </Alert>
  );
}

function ErrorAlert({ phase }: { phase: Extract<Phase, { kind: "error" }> }) {
  const isMisconfig = phase.code === "backend_not_configured";
  const Icon = isMisconfig ? ServerCrash : ShieldAlert;
  return (
    <Alert variant={isMisconfig ? "warning" : "destructive"}>
      <Icon className="size-4" />
      <AlertTitle>
        {isMisconfig ? "backend not deployed" : "submission failed"}
      </AlertTitle>
      <AlertDescription className="space-y-1 text-xs leading-relaxed">
        <p>{phase.message}</p>
        {phase.code ? (
          <p className="font-mono text-[10px] text-muted-foreground">
            code: {phase.code}
          </p>
        ) : null}
        {isMisconfig ? (
          <p>
            Browse the curated read-only runs at{" "}
            <a href="/runs" className="underline underline-offset-2">
              /runs
            </a>{" "}
            in the meantime.
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
