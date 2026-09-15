import type { RIRValue } from "../types/logs";

const OPTIONS: RIRValue[] = ["0", "1", "2", "3+"];

interface Props {
  value: RIRValue | null;
  onChange: (value: RIRValue) => void;
}

export function RIRSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {OPTIONS.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`h-12 rounded-xl text-base font-semibold transition-colors active:scale-95 ${
              selected
                ? "bg-accent-600 text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
