import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { JDAnalysis } from "@/lib/types";

export function JDAnalysisCard({ analysis }: { analysis: JDAnalysis }) {
  const fields: { label: string; value: string }[] = [
    { label: "role family", value: analysis.role_family },
    { label: "seniority", value: analysis.seniority },
    {
      label: "yoe required",
      value: analysis.yoe_required != null ? String(analysis.yoe_required) : "—",
    },
    { label: "domain", value: analysis.domain },
    { label: "company", value: analysis.company ?? "—" },
    { label: "role title", value: analysis.role_title ?? "—" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>jd_analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label}>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {f.label}
              </dt>
              <dd className="mt-0.5 font-mono text-sm">{f.value}</dd>
            </div>
          ))}
        </dl>

        <SkillList label="required_skills" skills={analysis.required_skills} variant="default" />
        <SkillList label="nice_to_have" skills={analysis.nice_to_have} variant="outline" />
      </CardContent>
    </Card>
  );
}

function SkillList({
  label,
  skills,
  variant,
}: {
  label: string;
  skills: string[];
  variant: "default" | "outline";
}) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label} <span className="opacity-60">({skills.length})</span>
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {skills.length === 0 ? (
          <span className="font-mono text-xs text-muted-foreground">—</span>
        ) : (
          skills.map((s) => (
            <Badge key={s} variant={variant} className="font-mono text-[11px]">
              {s}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
