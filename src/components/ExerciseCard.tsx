import { useMemo, useState } from "react";
import type { ExerciseGroup } from "../types/program";
import type { LoggedSet, RIRValue, WorkoutSession } from "../types/logs";
import { isSetFilled, isSetLogged } from "../types/logs";
import { RIRSelector } from "./RIRSelector";
import { VideoEmbed } from "./VideoEmbed";
import { RestTimer } from "./RestTimer";
import { useApp } from "../context/AppContext";
import { findLastLoggedSet } from "../lib/history";
import { getLiteralWorkingSets } from "../lib/program";
import { getIncrementKg } from "../lib/increments";
import { getWeightSuggestion } from "../lib/suggestions";
import { getPersonalRecord } from "../lib/records";

interface Props {
  group: ExerciseGroup;
  groupIndexInDay: number;
  programIndex: number;
  active: boolean;
  onActivate: () => void;
  session: WorkoutSession;
  onUpdateSession: (updater: (session: WorkoutSession) => WorkoutSession) => void;
}

function summarizeSets(group: ExerciseGroup): string {
  const literal = getLiteralWorkingSets(group);
  if (literal.length === 0) return "";
  return `${literal.length} serie${literal.length > 1 ? "s" : ""} · ${literal[0].reps} reps`;
}

export function ExerciseCard({
  group,
  groupIndexInDay,
  programIndex,
  active,
  onActivate,
  session,
  onUpdateSession,
}: Props) {
  const { logs, settings } = useApp();
  const [showSubs, setShowSubs] = useState(false);
  const [restSignal, setRestSignal] = useState(0);

  const literalSets = useMemo(() => getLiteralWorkingSets(group), [group]);
  const warmup = group.sets.find((s) => s.type === "warmup");

  const loggedExercise = session.exercises[groupIndexInDay];
  const displayName = loggedExercise?.exercise ?? group.exercise;
  const isSubstituted = Boolean(loggedExercise?.originalExercise);
  const allLogged = loggedExercise?.sets.every(isSetLogged) ?? false;
  const incrementKg = getIncrementKg(settings.exerciseIncrements, displayName);
  const pr = useMemo(() => getPersonalRecord(logs, displayName), [logs, displayName]);

  function updateSet(setIndex: number, patch: Partial<LoggedSet>) {
    onUpdateSession((prev) => {
      const exercises = prev.exercises.map((ex, idx) => {
        if (idx !== groupIndexInDay) return ex;
        const sets = ex.sets.map((s) => {
          if (s.setIndex !== setIndex) return s;
          const next = { ...s, ...patch };
          // Editar peso/reps/RIR invalida una confirmación previa; hay que reconfirmar.
          if (!("confirmed" in patch)) next.confirmed = false;
          return next;
        });
        return { ...ex, sets };
      });
      return { ...prev, exercises, updatedAt: new Date().toISOString() };
    });
  }

  function substituteExercise(newName: string | null) {
    const hasData = loggedExercise?.sets.some(isSetFilled) ?? false;
    if (hasData) {
      const label = newName ?? group.exercise;
      if (!window.confirm(`Ya cargaste datos para "${displayName}". ¿Reemplazar por "${label}" y reiniciar las series?`)) {
        return;
      }
    }
    onUpdateSession((prev) => {
      const exercises = prev.exercises.map((ex, idx) => {
        if (idx !== groupIndexInDay) return ex;
        const finalName = newName ?? group.exercise;
        return {
          ...ex,
          exercise: finalName,
          originalExercise: finalName === group.exercise ? null : group.exercise,
          sets: ex.sets.map((s) => ({ ...s, weightKg: null, reps: null, rir: null, confirmed: false })),
        };
      });
      return { ...prev, exercises, updatedAt: new Date().toISOString() };
    });
    setShowSubs(false);
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100">
            {displayName}
            {isSubstituted && (
              <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">sustituto</span>
            )}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{summarizeSets(group)}</p>
        </div>
        {allLogged && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            hecho
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-accent-200 bg-white p-4 shadow-sm dark:border-accent-800/60 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{displayName}</h3>
          {isSubstituted && (
            <button
              type="button"
              onClick={() => substituteExercise(null)}
              className="text-sm font-medium text-amber-600 underline dark:text-amber-400"
            >
              sustituyendo a {group.exercise} · volver al original
            </button>
          )}
          {group.intensityTechnique && (
            <p className="text-sm font-medium text-accent-600 dark:text-accent-400">
              {group.intensityTechnique}
            </p>
          )}
          {pr && (
            <p className="text-xs text-slate-400">
              PR: {pr.weightKg}kg × {pr.reps}
            </p>
          )}
        </div>
        {group.rest && (
          <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
            descanso {group.rest}
          </span>
        )}
      </div>

      {!isSubstituted && <VideoEmbed url={group.videoUrl} />}

      {!isSubstituted && group.notes && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{group.notes}</p>
      )}

      {warmup && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Calentamiento: {warmup.count} serie{warmup.count !== "1" ? "s" : ""} livianas
        </p>
      )}

      <div className="mt-4 space-y-4">
        {literalSets.map((set, i) => {
          const logged = loggedExercise?.sets.find((s) => s.setIndex === i) ?? {
            setIndex: i,
            weightKg: null,
            reps: null,
            rir: null,
            confirmed: false,
          };
          const lastTime = findLastLoggedSet(logs, displayName, i, programIndex);
          const suggestion = getWeightSuggestion(logs, displayName, i, programIndex, incrementKg);
          const filled = isSetFilled(logged);
          const done = isSetLogged(logged);
          const isNewPR = filled && logged.weightKg !== null && (!pr || logged.weightKg > pr.weightKg);

          return (
            <div
              key={i}
              className={`rounded-lg border p-3 ${
                done
                  ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-900/10"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Serie {i + 1} · objetivo {set.reps} reps
                  {set.targetRIR !== "-" ? ` · RIR ${set.targetRIR}` : ""}
                </span>
                {lastTime && (
                  <span className="text-xs text-slate-400">
                    última vez: {lastTime.weightKg}kg × {lastTime.reps}, RIR {lastTime.rir}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Peso (kg)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    value={logged.weightKg ?? ""}
                    onChange={(e) =>
                      updateSet(i, { weightKg: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-lg font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Reps</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    value={logged.reps ?? ""}
                    onChange={(e) =>
                      updateSet(i, { reps: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-lg font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                  />
                </label>
              </div>

              {suggestion && logged.weightKg === null && (
                <button
                  type="button"
                  onClick={() => updateSet(i, { weightKg: suggestion.weightKg })}
                  className="mt-2 text-xs font-medium text-accent-600 dark:text-accent-400"
                >
                  Sugerido: {suggestion.weightKg}kg ({suggestion.reason})
                </button>
              )}

              {isNewPR && (
                <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  🏆 Nuevo récord personal
                </p>
              )}

              <div className="mt-3">
                <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">RIR</span>
                <RIRSelector value={logged.rir} onChange={(rir: RIRValue) => updateSet(i, { rir })} />
              </div>

              <button
                type="button"
                disabled={!filled}
                onClick={() => {
                  const nowConfirmed = !logged.confirmed;
                  updateSet(i, { confirmed: nowConfirmed });
                  if (nowConfirmed) setRestSignal((n) => n + 1);
                }}
                className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold transition-colors ${
                  done
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-400 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-500"
                }`}
              >
                {done ? "✓ Serie confirmada" : "Confirmar serie ✓"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <RestTimer startSignal={restSignal} targetLabel={group.rest} />
      </div>

      {(group.substitutions.length > 0 || isSubstituted) && (
      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setShowSubs((s) => !s)}
          className="text-sm font-medium text-slate-500 dark:text-slate-400"
        >
          {showSubs ? "Ocultar sustituciones" : "¿No tenés el equipo? Ver sustituciones"}
        </button>
        {showSubs && (
          <div className="mt-2 flex flex-wrap gap-2">
            {isSubstituted && (
              <button
                type="button"
                onClick={() => substituteExercise(null)}
                className="rounded-full border border-accent-300 px-3 py-1 text-sm text-accent-700 dark:border-accent-700 dark:text-accent-300"
              >
                ← {group.exercise} (original)
              </button>
            )}
            {group.substitutions
              .filter((sub) => sub !== displayName)
              .map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => substituteExercise(sub)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  {sub}
                </button>
              ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
