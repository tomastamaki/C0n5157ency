import { useApp } from "../context/AppContext";
import { formatRelative } from "../lib/time";

export function SyncIndicator() {
  const { syncStatus, syncError, lastSyncedAt, retrySync } = useApp();

  const dotColor: Record<typeof syncStatus, string> = {
    "not-configured": "bg-faint",
    idle: "bg-faint",
    pending: "bg-warning",
    syncing: "bg-warning animate-pulse",
    saved: "bg-success",
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
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className={`h-2 w-2 rounded-full ${dotColor[syncStatus]}`} />
      <span>{label[syncStatus]}</span>
      {syncStatus === "error" && (
        <button
          type="button"
          onClick={retrySync}
          className="font-medium text-primary underline"
          title={syncError ?? undefined}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
