import { cn } from "@/lib/utils";

const ITEMS: { label: string; classes: string; meaning: string }[] = [
  {
    label: "AI",
    classes: "bg-indigo-50 border-indigo-300 text-indigo-900",
    meaning: "one LLM call, schema-enforced output",
  },
  {
    label: "code",
    classes: "bg-emerald-50 border-emerald-300 text-emerald-900",
    meaning: "deterministic Python, no LLM",
  },
  {
    label: "HITL",
    classes: "bg-amber-50 border-amber-300 text-amber-900",
    meaning: "human-in-the-loop, only on borderline cases",
  },
  {
    label: "terminal",
    classes: "bg-neutral-100 border-neutral-300 text-neutral-700",
    meaning: "graph entry / exit, RunRecord write",
  },
];

export function NodeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-muted-foreground">
      {ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block rounded border-[1.5px] px-1.5 py-0.5 text-[10px]",
              item.classes
            )}
          >
            {item.label}
          </span>
          <span>{item.meaning}</span>
        </div>
      ))}
    </div>
  );
}
