import { IconMinus, IconPlus } from "../icons";

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

/** Contador +/- (veces por semana, cada N días). */
export function Stepper({ value, min = 1, max = 99, onChange }: StepperProps) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-pill border border-border bg-surface">
      <button
        type="button"
        aria-label="Restar"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-10 w-10 items-center justify-center text-muted disabled:opacity-40"
      >
        <IconMinus className="h-4 w-4" />
      </button>
      <span className="min-w-[44px] text-center font-mono font-bold text-ink">{value}</span>
      <button
        type="button"
        aria-label="Sumar"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-10 w-10 items-center justify-center text-muted disabled:opacity-40"
      >
        <IconPlus className="h-4 w-4" />
      </button>
    </div>
  );
}
