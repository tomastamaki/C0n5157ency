const LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

interface DayOfWeekPickerProps {
  /** índice 0=lunes..6=domingo, igual que el resto del proyecto */
  selected: number[];
  onToggle: (day: number) => void;
}

/** Selector de días específicos de la semana (lunes primero). */
export function DayOfWeekPicker({ selected, onToggle }: DayOfWeekPickerProps) {
  return (
    <div className="flex gap-1.5">
      {LETTERS.map((letter, i) => (
        <button
          key={i}
          type="button"
          aria-label={letter}
          aria-pressed={selected.includes(i)}
          onClick={() => onToggle(i)}
          className={`flex h-10 w-10 items-center justify-center rounded-pill border text-[12.5px] font-bold ${
            selected.includes(i) ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted"
          }`}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}
