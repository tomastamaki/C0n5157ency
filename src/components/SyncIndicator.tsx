import { useApp } from "../context/AppContext";
import { formatRelative } from "../lib/time";

export function SyncIndicator() {
  const { syncStatus, syncError, lastSyncedAt, retrySync } = useApp();

  const dotColor: Record<typeof syncStatus, string> = {
    off: "bg-faint",
    idle: "bg-faint",
    pending: "bg-warning",
    syncing: "bg-warning animate-pulse",
    saved: "bg-success",
    error: "bg-red-500",
  };

  const label: Record<typeof syncStatus, string> = {
    off: "Guardado en este dispositivo",
    idle: "Sincronizado — sin cambios pendientes",
    pending: "Pendiente de subir…",
    syncing: "Sincronizando…",
    saved: lastSyncedAt ? `Sincronizado hace ${formatRelative(lastSyncedAt)}` : "Sincronizado",
    error: `Error: ${syncError ?? "no se pudo sincronizar"}`,
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor[syncStatus]}`} />
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
