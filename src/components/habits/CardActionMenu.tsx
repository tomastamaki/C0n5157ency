import { useState } from "react";
import { IconActivity, IconCheck, IconPencil, IconPlus } from "../icons";

interface Props {
  title: string;
  color: string;
  unit?: string;
  onClose: () => void;
  onEdit?: () => void;
  onAddExact?: (value: number) => void;
  onOpenDetail?: () => void;
}

/** Menú de acciones al mantener presionada una tarjeta de hábito: editar, cantidad exacta y ver detalle. */
export function CardActionMenu({ title, color, unit, onClose, onEdit, onAddExact, onOpenDetail }: Props) {
  const [exactOpen, setExactOpen] = useState(false);
  const [text, setText] = useState("");

  function submitExact() {
    const value = Number(text.replace(",", "."));
    if (!text || Number.isNaN(value) || value <= 0 || !onAddExact) return;
    onAddExact(value);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center px-4 pb-6 md:items-center"
      style={{ backgroundColor: "rgba(5,6,9,0.5)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-2 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2.5 text-sm font-bold text-ink">{title}</div>
        <div className="flex flex-col">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onEdit();
                onClose();
              }}
              className="flex items-center gap-3 rounded-block px-3 py-3 text-left text-sm font-semibold text-ink active:bg-surface2"
            >
              <IconPencil className="h-[18px] w-[18px]" style={{ color }} />
              Editar
            </button>
          )}
          {onAddExact && !exactOpen && (
            <button
              type="button"
              onClick={() => setExactOpen(true)}
              className="flex items-center gap-3 rounded-block px-3 py-3 text-left text-sm font-semibold text-ink active:bg-surface2"
            >
              <IconPlus className="h-[18px] w-[18px]" style={{ color }} />
              Cantidad exacta
            </button>
          )}
          {onAddExact && exactOpen && (
            <div className="flex items-center gap-2 px-3 py-2.5">
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitExact()}
                placeholder={`valor en ${unit ?? ""}`}
                className="h-10 flex-1 rounded-pill border border-border bg-surface2 px-3 font-mono text-sm text-ink outline-none"
              />
              <button
                type="button"
                aria-label="Agregar valor exacto"
                onClick={submitExact}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-habitink"
                style={{ backgroundColor: color }}
              >
                <IconCheck className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </div>
          )}
          {onOpenDetail && (
            <button
              type="button"
              onClick={() => {
                onOpenDetail();
                onClose();
              }}
              className="flex items-center gap-3 rounded-block px-3 py-3 text-left text-sm font-semibold text-ink active:bg-surface2"
            >
              <IconActivity className="h-[18px] w-[18px]" style={{ color }} />
              Ver detalle
            </button>
          )}
        </div>
        <button type="button" onClick={onClose} className="mt-1 w-full rounded-pill py-2.5 text-sm font-semibold text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}
