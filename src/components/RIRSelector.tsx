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
            className={`h-12 rounded-pill font-mono text-base font-semibold transition-colors active:scale-95 ${
              selected ? "bg-primary text-white" : "bg-surface2 text-faint"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
