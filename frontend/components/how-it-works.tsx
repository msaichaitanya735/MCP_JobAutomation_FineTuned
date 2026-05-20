import { Code2, Cpu, Gauge, RotateCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ITEMS = [
  {
    icon: Cpu,
    title: "1 LLM call. 8 deterministic nodes.",
    body: "The eligibility node emits both the parsed JD analysis AND the routing verdict in one structured output. Story selection, skills assembly, ATS scoring, and DOCX/PDF generation are pure Python. No tokens spent on work that doesn't need judgment.",
  },
  {
    icon: Code2,
    title: "Schema-enforced everywhere.",
    body: "Every node boundary is a Pydantic model. LLM nodes use Anthropic tool-use to force the model to emit a payload that matches a schema, validated before it ever leaves the call site. No regex parsing, no JSON cleanup.",
  },
  {
    icon: Gauge,
    title: "Native per-node telemetry.",
    body: "A @track_node decorator wraps every step and a ContextVar accumulator captures latency, tokens, and cost from inside the LLM client. Failures still record metrics. Every run becomes one immutable RunRecord at the terminal.",
  },
  {
    icon: RotateCw,
    title: "Bounded retry on the ATS gap.",
    body: "When the deterministic ATS scorer falls below 0.75, the missing-keyword list is fed back to compose_resume_content for one more attempt. Two retries max, then we log it and stop. No infinite loops.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="container border-t py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          design choices, made deliberately
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Every line below was an explicit trade-off discussion. The cost of an
          extra LLM call. The cost of a deterministic shortcut missing a nuance.
          The cost of a retry loop versus a hard fail.
        </p>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  <CardTitle>{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed text-foreground/80">
                  {item.body}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
