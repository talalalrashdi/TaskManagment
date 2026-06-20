"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--primary)] px-4 py-2 text-white shadow-[0_18px_36px_-20px_rgba(99,102,241,0.85)] hover:translate-y-[-1px] hover:bg-[#5458ee]",
        secondary:
          "bg-[var(--surface-strong)] px-4 py-2 text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]",
        ghost: "px-3 py-2 text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
        danger: "bg-[var(--danger)] px-4 py-2 text-white hover:bg-[#dc2626]",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-panel rounded-[28px] p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(99,102,241,0.18)]",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(99,102,241,0.18)]",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(99,102,241,0.18)]",
        props.className,
      )}
    />
  );
}

export function Badge({
  className,
  style,
  children,
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      style={style}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("h-2 rounded-full bg-[var(--surface-muted)]", className)}>
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--secondary))]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Skeleton({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-[linear-gradient(90deg,rgba(148,163,184,0.12),rgba(148,163,184,0.26),rgba(148,163,184,0.12))]",
        className,
      )}
    />
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
