import { useState } from "react";
import { useApp } from "../context/AppContext";
import { getCurrentFlatDay, getNextProgramIndex } from "../lib/schedule";
import { getLiteralWorkingSets } from "../lib/program";
import { getPreferredExercise } from "../lib/history";
import { newId } from "../lib/id";
import { formatDuration } from "../lib/time";
import { ExerciseCard } from "../components/ExerciseCard";
import { SyncIndicator } from "../components/SyncIndicator";
import { SessionTimer } from "../components/SessionTimer";
import { ProgramProgress } from "../components/ProgramProgress";
import { isSetLogged, type WorkoutSession } from "../types/logs";
import type { FlatProgramDay } from "../types/program";

function StartCard({
  flatDay,
  onStart,
  onSkip,
}: {
  flatDay: FlatProgramDay;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {flatDay.blockName} · Semana {flatDay.weekNumber} de {flatDay.totalWeeks} · {flatDay.weekLabel}
      </p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{flatDay.day.name}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {flatDay.day.exerciseGroups.length} ejercicios
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-xl bg-accent-600 py-3 text-base font-semibold text-white active:scale-[0.98]"
      >
        Empezar entrenamiento de hoy
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="mt-3 text-sm text-slate-400 underline"
      >
        Saltear este día
      </button>
    </div>
  );
}

function PausedCard({
  draft,
  onResume,
}: {
  draft: WorkoutSession;
  onResume: () => void;
}) {
  const totalSets = draft.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const doneSets = draft.exercises.reduce((sum, ex) => sum + ex.sets.filter(isSetLogged).length, 0);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-900/20">
      <p className="text-sm text-amber-700 dark:text-amber-300">Entrenamiento en pausa</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{draft.dayName}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Semana {draft.weekNumber} · {doneSets} de {totalSets} series confirmadas
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-700 dark:text-slate-200">
        <SessionTimer pausedElapsedSec={draft.pausedElapsedSec} runningSince={draft.runningSince} />
      </p>
      <button
        type="button"
        onClick={onResume}
        className="mt-6 w-full rounded-xl bg-accent-600 py-3 text-base font-semibold text-white active:scale-[0.98]"
      >
        Continuar entrenamiento
      </button>
    </div>
  );
}

function ProgramCompleteView() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">¡Programa completo!</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Completaste las 12 semanas de Min-Max Phase 2. Revisá tu progreso en Historial.
      </p>
    </div>
  );
}

function SummaryView({ session, onContinue }: { session: WorkoutSession; onContinue: () => void }) {
  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-900/20">
        <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-200">
          ¡Entrenamiento completado!
        </h2>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          {session.dayName} · Semana {session.weekNumber}
          {session.durationSec !== null && ` · ${formatDuration(session.durationSec)}`}
        </p>
      </div>
      <div className="space-y-2">
        {session.exercises.map((ex, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {ex.exercise}
              {ex.originalExercise && (
                <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                  sustituyó a {ex.originalExercise}
                </span>
              )}
            </p>
            <p className="text-slate-500 dark:text-slate-400">
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
        className="w-full rounded-xl bg-accent-600 py-3 text-base font-semibold text-white active:scale-[0.98]"
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

export function TodayScreen() {
  const { flatDays, logs, upsertSession } = useApp();
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);

  const nextIndex = getNextProgramIndex(logs);
  const flatDay = getCurrentFlatDay(flatDays, logs);
  const draft = flatDay
    ? logs.sessions.find((s) => s.programIndex === nextIndex && s.status === "in_progress") ?? null
    : null;

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
    if (!draft) return;
    upsertSession(updater(draft));
  }

  function pauseWorkout() {
    if (!draft || !draft.runningSince) return;
    const now = new Date().toISOString();
    updateDraft((prev) => ({
      ...prev,
      pausedElapsedSec: currentElapsedSec(prev),
      runningSince: null,
      updatedAt: now,
    }));
  }

  function resumeWorkout() {
    if (!draft) return;
    const now = new Date().toISOString();
    updateDraft((prev) => ({ ...prev, runningSince: now, updatedAt: now }));
  }

  if (completedSession) {
    return <SummaryView session={completedSession} onContinue={() => setCompletedSession(null)} />;
  }

  if (!flatDay) {
    return (
      <div className="space-y-4 pb-24">
        <ProgramProgress />
        <ProgramCompleteView />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="space-y-4 pb-24">
        <ProgramProgress />
        <StartCard flatDay={flatDay} onStart={() => startWorkout(flatDay)} onSkip={() => skipDay(flatDay)} />
      </div>
    );
  }

  if (!draft.runningSince) {
    return (
      <div className="space-y-4 pb-24">
        <ProgramProgress />
        <PausedCard draft={draft} onResume={resumeWorkout} />
      </div>
    );
  }

  const allDone = draft.exercises.every((ex) => ex.sets.every(isSetLogged));

  return (
    <div className="space-y-4 pb-24">
      <ProgramProgress />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {draft.blockName} · Semana {draft.weekNumber} de {flatDay.totalWeeks} · {draft.weekLabel}
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{draft.dayName}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            <SessionTimer pausedElapsedSec={draft.pausedElapsedSec} runningSince={draft.runningSince} />
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SyncIndicator />
          <button
            type="button"
            onClick={pauseWorkout}
            className="text-xs font-medium text-slate-400 underline"
          >
            Pausar y volver
          </button>
        </div>
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
            onUpdateSession={updateDraft}
          />
        ))}
      </div>

      {allDone && (
        <button
          type="button"
          onClick={() => {
            const now = new Date().toISOString();
            const durationSec = Math.max(0, Math.round(currentElapsedSec(draft)));
            const finished: WorkoutSession = {
              ...draft,
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
          className="w-full rounded-xl bg-accent-600 py-3 text-base font-semibold text-white active:scale-[0.98]"
        >
          Terminar entrenamiento
        </button>
      )}
    </div>
  );
}
