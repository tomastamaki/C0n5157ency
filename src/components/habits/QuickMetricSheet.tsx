import { useState } from "react";
import type { Habit } from "../../types/habits";
import { QuickAddRow } from "./QuickAddRow";
import { IconCheck } from "../icons";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Peso: valor exacto prellenado con el último registrado, ajustable de a ±0,1 (no tiene sentido como botones rápidos absolutos, es un valor que se corrige de a poco). */
function WeightStepper({ habit, color, lastValue, onAdd }: { habit: Habit; color: string; lastValue: number | null; onAdd: (value: number) => void }) {
  const [value, setValue] = useState(lastValue ?? 0);
  const [text, setText] = useState(String(lastValue ?? ""));

  function setBoth(n: number) {
    setValue(n);
    setText(String(n));
  }

  function onTextChange(t: string) {
    setText(t);
    const n = Number(t.replace(",", "."));
    if (!Number.isNaN(n)) setValue(n);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Restar 0,1 kg"
          onClick={() => setBoth(round1(value - 0.1))}
          className="tap-target flex h-10 w-10 items-center justify-center rounded-full border border-border text-lg font-bold text-ink"
        >
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={habit.unit ?? ""}
          className="h-11 w-24 rounded-pill border border-border bg-surface2 px-2 text-center font-mono text-lg font-bold text-ink outline-none"
        />
        <button
          type="button"
          aria-label="Sumar 0,1 kg"
          onClick={() => setBoth(round1(value + 0.1))}
          className="tap-target flex h-10 w-10 items-center justify-center rounded-full border border-border text-lg font-bold text-ink"
        >
          +
        </button>
      </div>
      <button
        type="button"
        disabled={value <= 0}
        onClick={() => onAdd(value)}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-pill text-sm font-semibold text-habitink disabled:opacity-40"
        style={{ backgroundColor: color }}
      >
        <IconCheck className="h-4 w-4" strokeWidth={2.6} />
        Guardar
      </button>
    </div>
  );
}

interface Props {
  habit: Habit;
  color: string;
  /** Último valor conocido (cualquier fecha), para prellenar Peso. */
  lastValue: number | null;
  onAdd: (value: number | null, secondaryValue?: number | null) => void;
  onOpenDetail: () => void;
  onClose: () => void;
}

/** Hoja inferior de carga rápida desde "Hoy" para Peso/Sueño/Pasos (HABI7 v2 Fase 6A). */
export function QuickMetricSheet({ habit, color, lastValue, onAdd, onOpenDetail, onClose }: Props) {
  // Peso es un solo valor con "Guardar" explícito: cierra al confirmar. Sueño/Pasos tienen botones rápidos
  // (horas y calidad por separado, "ambos opcionales"): quedan abiertos para poder cargar más de uno seguido.
  function saveAndClose(value: number) {
    onAdd(value);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center px-4 pb-24 md:items-center md:pb-6"
      style={{ backgroundColor: "rgba(5,6,9,0.5)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-4 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={onOpenDetail} className="text-sm font-bold text-ink underline underline-offset-2">
            {habit.name}
          </button>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-muted">
            Cerrar
          </button>
        </div>

        {habit.metricKind === "weight" ? (
          <WeightStepper habit={habit} color={color} lastValue={lastValue} onAdd={saveAndClose} />
        ) : (
          <QuickAddRow habit={habit} color={color} onAdd={onAdd} />
        )}
      </div>
    </div>
  );
}
