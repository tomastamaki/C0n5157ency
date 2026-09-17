import { useApp } from "../context/AppContext";
import { getCurrentWeekDays } from "../lib/schedule";
import { HomeDashboard } from "../components/HomeDashboard";
import type { WorkoutSession } from "../types/logs";

function ProgramCompleteView() {
  return (
    <div className="rounded-card border border-border bg-surface p-6 text-center shadow-elevated-sm">
      <h2 className="text-xl font-bold text-ink">¡Programa completo!</h2>
      <p className="mt-2 text-sm text-muted">
        Completaste las 12 semanas de Min-Max Phase 2. Revisá tu progreso en Historial.
      </p>
    </div>
  );
}

interface Props {
  activeDraft: WorkoutSession | null;
  onNavigateHistory: () => void;
  onResumeWorkout: () => void;
}

export function TodayScreen({ activeDraft, onNavigateHistory, onResumeWorkout }: Props) {
  const { flatDays, logs } = useApp();
  const weekDays = getCurrentWeekDays(flatDays, logs);

  if (weekDays.length === 0) {
    return (
      <div className="space-y-4 pb-24">
        <ProgramCompleteView />
      </div>
    );
  }

  return (
    <HomeDashboard
      weekDays={weekDays}
      activeDraft={activeDraft}
      onNavigateHistory={onNavigateHistory}
      onEnterWorkout={onResumeWorkout}
    />
  );
}
