import type { ReactNode } from "react";

export type PillTone = "ok" | "warn" | "neu" | "pri" | "acc";

const TONE_CLASS: Record<PillTone, string> = {
  ok: "bg-success/15 text-success",
  warn: "bg-warning/15 text-warning",
  neu: "bg-surface2 text-muted",
  pri: "bg-primary/15 text-primary",
  acc: "bg-accent/15 text-accent",
};

interface PillProps {
  tone: PillTone;
  icon?: ReactNode;
  children: ReactNode;
}

/** Píldora de estado corto (cumplido, racha, vinculado, etc). Nunca rojo. */
export function Pill({ tone, icon, children }: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1 text-[11px] font-bold ${TONE_CLASS[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
