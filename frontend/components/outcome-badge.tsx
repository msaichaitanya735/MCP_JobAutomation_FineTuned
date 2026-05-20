import { CheckCircle2, CircleSlash, ShieldAlert, UserMinus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Outcome } from "@/lib/types";

const META: Record<Outcome, { label: string; variant: "success" | "warning" | "destructive" | "secondary"; Icon: typeof CheckCircle2 }> = {
  applied: { label: "applied", variant: "success", Icon: CheckCircle2 },
  skipped_hard_screen: { label: "skipped · hard_screen", variant: "secondary", Icon: ShieldAlert },
  skipped_eligibility: { label: "skipped · eligibility", variant: "secondary", Icon: CircleSlash },
  skipped_user: { label: "skipped · user", variant: "warning", Icon: UserMinus },
  failed_validation: { label: "failed · validation", variant: "destructive", Icon: XCircle },
  error: { label: "error", variant: "destructive", Icon: XCircle },
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const meta = META[outcome] ?? META.error;
  const Icon = meta.Icon;
  return (
    <Badge variant={meta.variant} className="gap-1">
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );
}
