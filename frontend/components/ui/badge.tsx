import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
        warning:
          "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
        ai: "border-transparent bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
        code: "border-transparent bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
