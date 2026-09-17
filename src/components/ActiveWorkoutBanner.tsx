import type { WorkoutSession } from "../types/logs";
import { IconPlay } from "./icons";

export function ActiveWorkoutBanner({ draft, onResume }: { draft: WorkoutSession; onResume: () => void }) {
  return (
    <button
      type="button"
      onClick={onResume}
      className="flex w-full items-center justify-between rounded-card border border-primary/40 bg-primary/10 p-4 text-left shadow-elevated-sm"
    >
      <div>
        <p className="text-sm font-semibold text-primary">Entrenamiento en curso</p>
        <p className="text-xs text-muted">
          {draft.dayName} · Semana {draft.weekNumber}
          {!draft.runningSince && " · en pausa"}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
        <IconPlay className="h-4 w-4" />
        Retomar
      </span>
    </button>
  );
}
