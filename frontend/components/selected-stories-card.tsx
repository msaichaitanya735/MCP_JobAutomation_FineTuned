import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SelectedStoriesEntry } from "@/lib/types";

export function SelectedStoriesCard({
  stories,
}: {
  stories: SelectedStoriesEntry[] | null | undefined;
}) {
  if (!stories || stories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>selected_stories</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-xs text-muted-foreground">
            select_stories did not run for this run.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group stories by company, preserving order.
  const groups = new Map<string, SelectedStoriesEntry[]>();
  for (const s of stories) {
    const arr = groups.get(s.company) ?? [];
    arr.push(s);
    groups.set(s.company, arr);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>selected_stories</CardTitle>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {stories.length} bullets · {groups.size} companies
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {Array.from(groups.entries()).map(([company, items]) => (
          <div key={company}>
            <h3 className="mb-2 font-mono text-xs font-semibold tracking-tight">
              {company}
            </h3>
            <ul className="space-y-2">
              {items.map((s) => (
                <li
                  key={s.story_id}
                  className="rounded-md border bg-muted/20 px-3 py-2"
                >
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {s.story_id}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      relevance · {s.relevance.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{s.resume_bullet}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
