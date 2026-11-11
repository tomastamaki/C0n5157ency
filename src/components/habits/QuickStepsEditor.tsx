import { useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPlus } from "../icons";

const MAX_STEPS = 4;

interface Props {
  steps: number[];
  unit: string;
  onChange: (steps: number[]) => void;
  /** Sugeridos para el botón "+ agregar", filtrados a los que todavía no están. */
  suggested: number[];
}

/** Botones rápidos configurables (1 a 4): se agregan, editan, borran y reordenan. */
export function QuickStepsEditor({ steps, unit, onChange, suggested }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  function update(i: number, value: number) {
    const next = [...steps];
    next[i] = value;
    onChange(next);
  }

  function remove(i: number) {
    onChange(steps.filter((_, idx) => idx !== i));
    setEditingIdx(null);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function addSuggested(value: number) {
    if (steps.length >= MAX_STEPS) return;
    onChange([...steps, value]);
  }

  const nextSuggested = suggested.find((v) => !steps.includes(v));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {steps.map((value, i) => (
          <div key={i} className="flex items-center gap-1 rounded-pill border border-border bg-surface px-2 py-1">
            <button type="button" aria-label="Mover a la izquierda" disabled={i === 0} onClick={() => move(i, -1)} className="text-faint disabled:opacity-30">
              <IconChevronLeft className="h-3.5 w-3.5" />
            </button>
            {editingIdx === i ? (
              <input
                type="number"
                autoFocus
                value={value}
                onChange={(e) => update(i, Number(e.target.value) || 0)}
                onBlur={() => setEditingIdx(null)}
                className="w-14 bg-transparent text-center font-mono text-sm font-bold text-ink outline-none"
              />
            ) : (
              <button type="button" onClick={() => setEditingIdx(i)} className="font-mono text-sm font-bold text-ink">
                +{value} {unit}
              </button>
            )}
            <button type="button" aria-label="Mover a la derecha" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="text-faint disabled:opacity-30">
              <IconChevronRight className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Quitar" onClick={() => remove(i)} className="ml-0.5 text-warning">
              ×
            </button>
          </div>
        ))}
        {steps.length < MAX_STEPS && (
          <button
            type="button"
            onClick={() => addSuggested(nextSuggested ?? 0)}
            className="flex items-center gap-1 rounded-pill border border-dashed border-border px-3 py-1 text-sm font-semibold text-muted"
          >
            <IconPlus className="h-3.5 w-3.5" />
            {nextSuggested !== undefined ? `+${nextSuggested} ${unit}` : "Agregar"}
          </button>
        )}
      </div>
      <p className="text-[11px] text-faint">Tocá un botón para editar su valor. Hasta {MAX_STEPS}.</p>
    </div>
  );
}
