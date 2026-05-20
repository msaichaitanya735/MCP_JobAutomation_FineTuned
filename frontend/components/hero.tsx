import Link from "next/link";
import { ArrowRight, BookOpen, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="container py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="outline" className="mb-6 font-mono">
          phase 1 · orchestration
        </Badge>

        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          agentic resume tailoring.
          <br />
          <span className="text-muted-foreground">
            ai for judgment, code for everything else.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-sm leading-relaxed text-muted-foreground md:text-base">
          A LangGraph state machine that takes one job description and produces a
          tailored resume. One LLM call does the genuine reasoning. Eight other
          nodes are deterministic Python. Every run records latency, tokens, and
          cost per node.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/runs" className="gap-1.5">
              browse runs <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/submit" className="gap-1.5">
              submit a JD
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <a
              href="https://github.com/msaichaitanya735/MCP_JobAutomation_FineTuned"
              target="_blank"
              rel="noreferrer"
              className="gap-1.5"
            >
              <Github className="size-4" />
              source
            </a>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="rounded border bg-muted/50 px-2 py-0.5">langgraph</span>
          <span className="rounded border bg-muted/50 px-2 py-0.5">pydantic</span>
          <span className="rounded border bg-muted/50 px-2 py-0.5">anthropic</span>
          <span className="rounded border bg-muted/50 px-2 py-0.5">aws lambda</span>
          <span className="rounded border bg-muted/50 px-2 py-0.5">amplify</span>
          <span className="rounded border bg-muted/50 px-2 py-0.5">next.js 15</span>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          <BookOpen className="mr-1 inline-block size-3" />
          this is a portfolio piece. read the architecture decisions in the{" "}
          <a
            href="https://github.com/msaichaitanya735/MCP_JobAutomation_FineTuned/blob/main/.kiro/steering/architecture.md"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            steering doc
          </a>
          .
        </p>
      </div>
    </section>
  );
}
