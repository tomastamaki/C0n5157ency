import { IconRotateCcw } from "../icons";

interface UndoToastProps {
  message: string;
  onUndo: () => void;
}

/** Aviso flotante tras una acción, con "Deshacer" — se auto-oculta a los 5s (lo maneja quien lo usa). */
export function UndoToast({ message, onUndo }: UndoToastProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-block bg-ink px-3.5 py-3 text-sm font-semibold text-bg shadow-elevated">
      <span>{message}</span>
      <button type="button" onClick={onUndo} className="inline-flex items-center gap-1.5 font-extrabold text-primary">
        <IconRotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />
        Deshacer
      </button>
    </div>
  );
}
