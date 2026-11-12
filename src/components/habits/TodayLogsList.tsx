import { useState } from "react";
import type { HabitLog, HabitSecondaryField } from "../../types/habits";
import { IconCheck, IconPencil, IconTrash } from "../icons";

interface Props {
  /** Ya ordenados del más reciente al más viejo (ver `logsForDate`). */
  logs: HabitLog[];
  unit: string;
  color: string;
  /** Campo secundario del hábito (ej. calidad de sueño), si tiene. */
  secondaryField?: HabitSecondaryField | null;
  onEdit: (logId: string, value: number | null, secondaryValue?: number | null) => void;
  onRemove: (logId: string) => void;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function parseOrNull(text: string): number | null {
  if (!text) return null;
  const n = Number(text.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function formatLog(log: HabitLog, unit: string, secondaryField?: HabitSecondaryField | null): string {
  const parts: string[] = [];
  if (log.value !== null) parts.push(`${log.value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} ${unit}`.trim());
  if (secondaryField && log.secondaryValue !== null) parts.push(`${secondaryField.label}: ${log.secondaryValue}`);
  return parts.join(" · ") || "—";
}

/** Lista de registros de hoy, editables y eliminables uno por uno (menú "mantener presionado" en la tarjeta también abre cantidad exacta, pero esto es por registro individual). */
export function TodayLogsList({ logs, unit, color, secondaryField = null, onEdit, onRemove }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [secondaryText, setSecondaryText] = useState("");

  if (logs.length === 0) {
    return <p className="text-xs text-faint">Todavía no hay registros hoy.</p>;
  }

  function startEdit(log: HabitLog) {
    setEditingId(log.id);
    setText(log.value === null ? "" : String(log.value));
    setSecondaryText(log.secondaryValue === null ? "" : String(log.secondaryValue));
  }

  function confirmEdit(logId: string) {
    const value = parseOrNull(text);
    const secondaryValue = secondaryField ? parseOrNull(secondaryText) : undefined;
    if (value === null && (secondaryValue === undefined || secondaryValue === null)) return;
    onEdit(logId, value, secondaryValue);
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-2 rounded-block bg-surface2 px-3 py-2">
          <span className="font-mono text-[11px] text-faint">{timeOf(log.createdAt)}</span>
          {editingId === log.id ? (
            <div className="ml-auto flex items-center gap-1.5">
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmEdit(log.id)}
                placeholder={unit}
                className="h-8 w-16 rounded-pill border border-border bg-surface px-2 font-mono text-[12.5px] text-ink outline-none"
              />
              {secondaryField && (
                <input
                  type="text"
                  inputMode="decimal"
                  value={secondaryText}
                  onChange={(e) => setSecondaryText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmEdit(log.id)}
                  placeholder={secondaryField.label}
                  className="h-8 w-16 rounded-pill border border-border bg-surface px-2 font-mono text-[12.5px] text-ink outline-none"
                />
              )}
              <button
                type="button"
                aria-label="Guardar registro"
                onClick={() => confirmEdit(log.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-habitink"
                style={{ backgroundColor: color }}
              >
                <IconCheck className="h-3.5 w-3.5" strokeWidth={2.6} />
              </button>
            </div>
          ) : (
            <>
              <span className="ml-auto font-mono text-sm font-bold text-ink">{formatLog(log, unit, secondaryField)}</span>
              <button type="button" aria-label="Editar registro" onClick={() => startEdit(log)} className="flex h-7 w-7 items-center justify-center text-muted">
                <IconPencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="Eliminar registro" onClick={() => onRemove(log.id)} className="flex h-7 w-7 items-center justify-center text-muted">
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
