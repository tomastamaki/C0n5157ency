import { useApp } from "../context/AppContext";
import { formatRelative } from "../lib/time";

/** Versión mínima de SyncIndicator para el header: solo el puntito, con el detalle en el title. */
export function SyncStatusDot() {
  const { syncStatus, syncError, lastSyncedAt } = useApp();

  const dotColor: Record<typeof syncStatus, string> = {
    off: "bg-faint",
    idle: "bg-faint",
    pending: "bg-warning",
    syncing: "bg-warning animate-pulse",
    saved: "bg-success",
    error: "bg-red-500",
  };

  const title: Record<typeof syncStatus, string> = {
    off: "Guardado en este dispositivo",
    idle: "Sincronizado — sin cambios pendientes",
    pending: "Pendiente de subir a GitHub",
    syncing: "Sincronizando con GitHub…",
    saved: lastSyncedAt ? `Sincronizado hace ${formatRelative(lastSyncedAt)}` : "Sincronizado",
    error: `Error al sincronizar: ${syncError ?? "desconocido"}`,
  };

  return (
    <span
      aria-label={title[syncStatus]}
      title={title[syncStatus]}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotColor[syncStatus]}`}
    />
  );
}
