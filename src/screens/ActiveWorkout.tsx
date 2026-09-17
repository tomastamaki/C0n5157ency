import { useState } from "react";
import { ExerciseCard } from "../components/ExerciseCard";
import { SyncIndicator } from "../components/SyncIndicator";
import { SessionTimer } from "../components/SessionTimer";
import { IconPause } from "../components/icons";
import { useWorkoutActions } from "../lib/useWorkoutActions";
import { isSetLogged, type WorkoutSession } from "../types/logs";
import { formatDuration } from "../lib/time";
import type { FlatProgramDay } from "../types/program";

function PausedCard({ draft, onResume }: { draft: WorkoutSession; onResume: () => void }) {
  const totalSets = draft.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const doneSets = draft.exercises.reduce((sum, ex) => sum + ex.sets.filter(isSetLogged).length, 0);

  return (
    <div className="rounded-card border border-warning/35 bg-warning/10 p-6 text-center shadow-elevated-sm">
      <p className="text-sm font-medium text-warning">Entrenamiento en pausa</p>
      <h2 className="mt-1 text-2xl font-bold text-ink">{draft.dayName}</h2>
      <p className="mt-1 font-mono text-sm text-muted">
        Semana {draft.weekNumber} · {doneSets} de {totalSets} series confirmadas
      </p>
      <p className="mt-2 text-lg font-semibold text-ink">
        <SessionTimer pausedElapsedSec={draft.pausedElapsedSec} runningSince={draft.runningSince} />
      </p>
      <button
        type="button"
        onClick={onResume}
        className="mt-6 w-full rounded-pill bg-primary py-3 text-base font-semibold text-white active:scale-[0.98]"
      >
        Continuar entrenamiento
      </button>
    </div>
  );
}

export function WorkoutSummary({ session, onContinue }: { session: WorkoutSession; onContinue: () => void }) {
  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-card border border-success/35 bg-success/10 p-6 text-center shadow-elevated-sm">
        <h2 className="text-xl font-bold text-success">¡Entrenamiento completado!</h2>
        <p className="mt-1 font-mono text-sm text-success">
          {session.dayName} · Semana {session.weekNumber}
          {session.durationSec !== null && ` · ${formatDuration(session.durationSec)}`}
        </p>
      </div>
      <div className="space-y-2">
        {session.exercises.map((ex, i) => (
          <div key={i} className="rounded-block border border-border bg-surface p-3 text-sm">
            <p className="font-medium text-ink">
              {ex.exercise}
              {ex.originalExercise && (
                <span className="ml-2 text-xs font-normal text-warning">sustituyó a {ex.originalExercise}</span>
              )}
            </p>
            <p className="font-mono text-muted">
              {ex.sets
                .filter(isSetLogged)
                .map((s) => `${s.weightKg}kg×${s.reps} (RIR ${s.rir})`)
                .join(" · ") || "sin registros"}
            </p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-pill bg-primary py-3 text-base font-semibold text-white active:scale-[0.98]"
      >
        Continuar
      </button>
    </div>
  );
}

interface Props {
  draft: WorkoutSession;
  flatDay: FlatProgramDay;
  /** Salir de la pantalla de entrenamiento sin terminarlo (queda en curso de fondo). */
  onExit: () => void;
  onFinish: (session: WorkoutSession) => void;
}

export function ActiveWorkoutScreen({ draft, flatDay, onExit, onFinish }: Props) {
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const { updateDraft, pauseWorkout, resumeWorkout, finishWorkout } = useWorkoutActions();

  if (!draft.runningSince) {
    return (
      <div className="space-y-4 pb-24">
        <PausedCard draft={draft} onResume={() => resumeWorkout(draft)} />
      </div>
    );
  }

  const allDone = draft.exercises.every((ex) => ex.sets.every(isSetLogged));

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              pauseWorkout(draft);
              onExit();
            }}
            aria-label="Pausar y volver"
            title="Pausar y volver"
            className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill border border-primary/35 bg-primary/8 text-primary transition-transform hover:bg-primary/14 active:scale-95"
          >
            <IconPause className="h-4 w-4" />
          </button>
          <div>
            <p className="text-sm text-muted">
              {draft.blockName} · Semana {draft.weekNumber} de {flatDay.totalWeeks} · {draft.weekLabel}
            </p>
            <h2 className="text-xl font-bold text-ink">{draft.dayName}</h2>
            <p className="mt-0.5 text-sm text-muted">
              <SessionTimer pausedElapsedSec={draft.pausedElapsedSec} runningSince={draft.runningSince} />
            </p>
          </div>
        </div>
        <SyncIndicator />
      </div>

      <div className="space-y-3">
        {flatDay.day.exerciseGroups.map((group, i) => (
          <ExerciseCard
            key={i}
            group={group}
            groupIndexInDay={i}
            programIndex={flatDay.index}
            active={i === activeGroupIdx}
            onActivate={() => setActiveGroupIdx(i)}
            session={draft}
            onUpdateSession={(updater) => updateDraft(draft, updater)}
          />
        ))}
      </div>

      {allDone && (
        <button
          type="button"
          onClick={() => onFinish(finishWorkout(draft))}
          className="w-full rounded-pill bg-primary py-3 text-base font-semibold text-white active:scale-[0.98]"
        >
          Terminar entrenamiento
        </button>
      )}
    </div>
  );
}
