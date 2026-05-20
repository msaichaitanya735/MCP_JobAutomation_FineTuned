import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { PipelineGraph } from "@/components/pipeline-graph";
import { NodeLegend } from "@/components/legend";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />

        <section className="container pb-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-mono text-sm font-semibold tracking-tight">
                  pipeline.graph
                </h2>
                <p className="text-xs text-muted-foreground">
                  the langgraph state machine. demo mode below loops the
                  successful path. on a real run the diagram annotates each
                  node with its measured latency, tokens, and cost.
                </p>
              </div>
              <NodeLegend />
            </div>
            <PipelineGraph mode="demo" height={760} />
          </div>
        </section>

        <HowItWorks />
      </main>
      <SiteFooter />
    </>
  );
}
