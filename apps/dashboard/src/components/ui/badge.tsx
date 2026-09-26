import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-none px-2 py-0.5 font-tech text-xs uppercase tracking-wider font-semibold",
  {
    variants: {
      variant: {
        default: "bg-brand-soft text-brand border border-brand/30",
        secondary: "bg-hover text-ink border border-line",
        outline: "border border-line-strong text-ink-muted",
        destructive: "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30",
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
