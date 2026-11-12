import { useState } from "react";
import { IconCheck } from "../icons";

/** Campo de valor exacto para hábitos de cantidad/tracking: siempre disponible, además de los botones rápidos. */
export function ExactValueField({ unit, color, onAdd }: { unit: string; color: string; onAdd: (value: number) => void }) {
  const [text, setText] = useState("");

  function submit() {
    const value = Number(text.replace(",", "."));
    if (!text || Number.isNaN(value) || value <= 0) return;
    onAdd(value);
    setText("");
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={`valor en ${unit}`}
        className="h-9 w-24 rounded-pill border border-border bg-surface px-2.5 font-mono text-[13px] text-ink outline-none"
      />
      <button
        type="button"
        aria-label="Agregar valor exacto"
        onClick={submit}
        className="tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-habitink"
        style={{ backgroundColor: color }}
      >
        <IconCheck className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
}
