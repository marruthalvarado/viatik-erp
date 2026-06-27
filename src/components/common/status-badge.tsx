import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground ring-border",
        success: "bg-success/10 text-success ring-success/20",
        warning: "bg-warning/15 text-warning-foreground ring-warning/30",
        danger: "bg-destructive/10 text-destructive ring-destructive/20",
        info: "bg-info/10 text-info ring-info/20",
        primary: "bg-primary/10 text-primary ring-primary/20",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
}

export function StatusBadge({ tone, dot = true, className, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
