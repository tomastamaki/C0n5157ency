import { useState } from "react";
import { useApp } from "../context/AppContext";
import { findActiveDraft, getCurrentWeekDays } from "../lib/schedule";
import { getLiteralWorkingSets } from "../lib/program";
import { getPreferredExercise } from "../lib/history";
import { newId } from "../lib/id";
import { formatDuration } from "../lib/time";
import { ExerciseCard } from "../components/ExerciseCard";
import { SyncIndicator } from "../components/SyncIndicator";
import { SessionTimer } from "../components/SessionTimer";
import { HomeDashboard } from "../components/HomeDashboard";
import { IconPause } from "../components/icons";
import { isSetLogged, type WorkoutSession } from "../types/logs";
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

function SummaryView({ session, onContinue }: { session: WorkoutSession; onContinue: () => void }) {
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

/** Segundos acumulados de una sesión hasta este momento (corriendo o en pausa). */
function currentElapsedSec(session: WorkoutSession): number {
  if (!session.runningSince) return session.pausedElapsedSec;
  const extra = (Date.now() - new Date(session.runningSince).getTime()) / 1000;
  return session.pausedElapsedSec + extra;
}

export function TodayScreen({ onNavigateHistory }: { onNavigateHistory: () => void }) {
  const { flatDays, logs, upsertSession } = useApp();
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);

  const weekDays = getCurrentWeekDays(flatDays, logs);
  const activeDraft = findActiveDraft(logs);
  const draftFlatDay = activeDraft ? flatDays[activeDraft.programIndex] ?? null : null;

  function startWorkout(day: FlatProgramDay) {
    const now = new Date().toISOString();
    const session: WorkoutSession = {
      id: newId(),
      programIndex: day.index,
      blockName: day.blockName,
      weekLabel: day.weekLabel,
      weekNumber: day.weekNumber,
      dayName: day.day.name,
      status: "in_progress",
      startedAt: now,
      completedAt: null,
      durationSec: null,
      runningSince: now,
      pausedElapsedSec: 0,
      updatedAt: now,
      exercises: day.day.exerciseGroups.map((g) => {
        const preferred = getPreferredExercise(logs, g.exercise, day.index);
        const chosen = preferred ?? g.exercise;
        return {
          exercise: chosen,
          originalExercise: chosen === g.exercise ? null : g.exercise,
          supersetGroup: g.supersetGroup,
          sets: getLiteralWorkingSets(g).map((_, i) => ({
            setIndex: i,
            weightKg: null,
            reps: null,
            rir: null,
            confirmed: false,
          })),
        };
      }),
    };
    upsertSession(session);
    setActiveGroupIdx(0);
  }

  function skipDay(day: FlatProgramDay) {
    if (!window.confirm(`¿Marcar "${day.day.name}" (semana ${day.weekNumber}) como salteado?`)) return;
    const now = new Date().toISOString();
    upsertSession({
      id: newId(),
      programIndex: day.index,
      blockName: day.blockName,
      weekLabel: day.weekLabel,
      weekNumber: day.weekNumber,
      dayName: day.day.name,
      status: "skipped",
      startedAt: now,
      completedAt: now,
      durationSec: null,
      runningSince: null,
      pausedElapsedSec: 0,
      updatedAt: now,
      exercises: [],
    });
  }

  function updateDraft(updater: (session: WorkoutSession) => WorkoutSession) {
    if (!activeDraft) return;
    upsertSession(updater(activeDraft));
  }

  function pauseWorkout() {
    if (!activeDraft || !activeDraft.runningSince) return;
    const now = new Date().toISOString();
    updateDraft((prev) => ({
      ...prev,
      pausedElapsedSec: currentElapsedSec(prev),
      runningSince: null,
      updatedAt: now,
    }));
  }

  function resumeWorkout() {
    if (!activeDraft) return;
    const now = new Date().toISOString();
    updateDraft((prev) => ({ ...prev, runningSince: now, updatedAt: now }));
  }

  if (completedSession) {
    return <SummaryView session={completedSession} onContinue={() => setCompletedSession(null)} />;
  }

  if (weekDays.length === 0) {
    return (
      <div className="space-y-4 pb-24">
        <ProgramCompleteView />
      </div>
    );
  }

  if (!activeDraft || !draftFlatDay) {
    return (
      <HomeDashboard
        weekDays={weekDays}
        onStart={startWorkout}
        onSkip={skipDay}
        onNavigateHistory={onNavigateHistory}
      />
    );
  }

  if (!activeDraft.runningSince) {
    return (
      <div className="space-y-4 pb-24">
        <PausedCard draft={activeDraft} onResume={resumeWorkout} />
      </div>
    );
  }

  const allDone = activeDraft.exercises.every((ex) => ex.sets.every(isSetLogged));

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={pauseWorkout}
            aria-label="Pausar y volver"
            title="Pausar y volver"
            className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill border border-primary/35 bg-primary/8 text-primary transition-transform hover:bg-primary/14 active:scale-95"
          >
            <IconPause className="h-4 w-4" />
          </button>
          <div>
            <p className="text-sm text-muted">
              {activeDraft.blockName} · Semana {activeDraft.weekNumber} de {draftFlatDay.totalWeeks} ·{" "}
              {activeDraft.weekLabel}
            </p>
            <h2 className="text-xl font-bold text-ink">{activeDraft.dayName}</h2>
            <p className="mt-0.5 text-sm text-muted">
              <SessionTimer pausedElapsedSec={activeDraft.pausedElapsedSec} runningSince={activeDraft.runningSince} />
            </p>
          </div>
        </div>
        <SyncIndicator />
      </div>

      <div className="space-y-3">
        {draftFlatDay.day.exerciseGroups.map((group, i) => (
          <ExerciseCard
            key={i}
            group={group}
            groupIndexInDay={i}
            programIndex={draftFlatDay.index}
            active={i === activeGroupIdx}
            onActivate={() => setActiveGroupIdx(i)}
            session={activeDraft}
            onUpdateSession={updateDraft}
          />
        ))}
      </div>

      {allDone && (
        <button
          type="button"
          onClick={() => {
            const now = new Date().toISOString();
            const durationSec = Math.max(0, Math.round(currentElapsedSec(activeDraft)));
            const finished: WorkoutSession = {
              ...activeDraft,
              status: "completed",
              completedAt: now,
              durationSec,
              runningSince: null,
              pausedElapsedSec: durationSec,
              updatedAt: now,
            };
            upsertSession(finished);
            setCompletedSession(finished);
          }}
          className="w-full rounded-pill bg-primary py-3 text-base font-semibold text-white active:scale-[0.98]"
        >
          Terminar entrenamiento
        </button>
      )}
    </div>
  );
}
