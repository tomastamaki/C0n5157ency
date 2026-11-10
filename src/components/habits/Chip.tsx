import type { ReactNode } from "react";

interface ChipProps {
  label: ReactNode;
  active?: boolean;
  dashed?: boolean;
  onClick?: () => void;
}

/** Chip de filtro/selección (categorías, frecuencia, botones rápidos de cantidad). */
export function Chip({ label, active, dashed, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-3.5 text-sm font-semibold ${
        active
          ? "border-primary bg-primary text-white"
          : dashed
            ? "border-dashed border-border bg-transparent text-muted"
            : "border-border bg-surface text-muted"
      }`}
    >
      {label}
    </button>
  );
}
