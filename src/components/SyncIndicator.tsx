import { useApp } from "../context/AppContext";
import { formatRelative } from "../lib/time";

export function SyncIndicator() {
  const { syncStatus, syncError, lastSyncedAt, retrySync } = useApp();

  const dotColor: Record<typeof syncStatus, string> = {
    "not-configured": "bg-slate-300 dark:bg-slate-600",
    idle: "bg-slate-300 dark:bg-slate-600",
    pending: "bg-amber-400",
    syncing: "bg-amber-400 animate-pulse",
    saved: "bg-emerald-500",
    error: "bg-red-500",
  };

  const label: Record<typeof syncStatus, string> = {
    "not-configured": "GitHub no configurado",
    idle: "Sin cambios para guardar",
    pending: "Cambios sin guardar…",
    syncing: "Guardando en GitHub…",
    saved: lastSyncedAt ? `Guardado ${formatRelative(lastSyncedAt)}` : "Guardado",
    error: "Error al guardar",
  };

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className={`h-2 w-2 rounded-full ${dotColor[syncStatus]}`} />
      <span>{label[syncStatus]}</span>
      {syncStatus === "error" && (
        <button
          type="button"
          onClick={retrySync}
          className="font-medium text-accent-600 underline dark:text-accent-400"
          title={syncError ?? undefined}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
