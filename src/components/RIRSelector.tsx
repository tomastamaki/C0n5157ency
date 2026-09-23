import type { RIRValue } from "../types/logs";

const OPTIONS: RIRValue[] = ["0", "1", "2", "3+"];

interface Props {
  value: RIRValue | null;
  onChange: (value: RIRValue) => void;
  size?: "normal" | "large";
}

export function RIRSelector({ value, onChange, size = "normal" }: Props) {
  const heightClass = size === "large" ? "h-16 text-xl" : "h-12 text-base";
  return (
    <div className="grid grid-cols-4 gap-2">
      {OPTIONS.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`${heightClass} rounded-pill font-mono font-semibold transition-colors active:scale-95 ${
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
