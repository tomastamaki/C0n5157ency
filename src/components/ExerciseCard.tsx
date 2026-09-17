import { useMemo, useState } from "react";
import type { ExerciseGroup } from "../types/program";
import type { LoggedSet, RIRValue, WorkoutSession } from "../types/logs";
import { isSetFilled, isSetLogged } from "../types/logs";
import { RIRSelector } from "./RIRSelector";
import { VideoEmbed } from "./VideoEmbed";
import { RestTimer } from "./RestTimer";
import { ProgressChart } from "./ProgressChart";
import { IconTrophy } from "./icons";
import { useApp } from "../context/AppContext";
import { findLastLoggedSet, getExerciseProgression } from "../lib/history";
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
  const { logs, settings, exerciseInfoIndex } = useApp();
  const [showSubs, setShowSubs] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [restSignal, setRestSignal] = useState(0);

  const literalSets = useMemo(() => getLiteralWorkingSets(group), [group]);
  const warmup = group.sets.find((s) => s.type === "warmup");

  const loggedExercise = session.exercises[groupIndexInDay];
  const displayName = loggedExercise?.exercise ?? group.exercise;
  const isSubstituted = Boolean(loggedExercise?.originalExercise);
  const allLogged = loggedExercise?.sets.every(isSetLogged) ?? false;
  const incrementKg = getIncrementKg(settings.exerciseIncrements, displayName);
  const pr = useMemo(() => getPersonalRecord(logs, displayName), [logs, displayName]);
  const progression = useMemo(
    () => getExerciseProgression(logs, displayName, 0),
    [logs, displayName]
  );
  const displayInfo = isSubstituted
    ? exerciseInfoIndex[displayName] ?? { videoUrl: null, notes: null }
    : { videoUrl: group.videoUrl, notes: group.notes };

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
        className="flex w-full items-center justify-between rounded-card border border-border bg-surface px-4 py-3 text-left"
      >
        <div>
          <p className="font-medium text-ink">
            {displayName}
            {isSubstituted && <span className="ml-2 text-xs font-normal text-warning">sustituto</span>}
          </p>
          <p className="text-sm text-muted">{summarizeSets(group)}</p>
        </div>
        {allLogged && (
          <span className="rounded-pill border border-success/35 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            hecho
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-card border border-primary bg-surface p-4 shadow-elevated-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">{displayName}</h3>
          {isSubstituted && (
            <button type="button" onClick={() => substituteExercise(null)} className="text-sm font-medium text-warning underline">
              sustituyendo a {group.exercise} · volver al original
            </button>
          )}
          {group.intensityTechnique && (
            <p className="text-sm font-medium text-primary">{group.intensityTechnique}</p>
          )}
          {pr && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <IconTrophy className="h-3.5 w-3.5 text-accent" />
              <span className="font-mono">
                PR: {pr.weightKg}kg × {pr.reps}
              </span>
            </p>
          )}
        </div>
        {group.rest && <span className="whitespace-nowrap text-xs text-muted">descanso {group.rest}</span>}
      </div>

      {progression.length > 0 && (
        <div className="mb-3">
          <button type="button" onClick={() => setShowChart((s) => !s)} className="text-sm font-medium text-primary">
            {showChart ? "Ocultar progresión" : "Ver progresión"}
          </button>
          {showChart && (
            <div className="mt-2 rounded-block border border-border p-3">
              <ProgressChart points={progression} />
            </div>
          )}
        </div>
      )}

      {displayInfo.videoUrl ? (
        <VideoEmbed url={displayInfo.videoUrl} />
      ) : (
        isSubstituted && (
          <p className="text-sm text-faint">
            Sin video de técnica disponible para este sustituto (no está en el programa original).
          </p>
        )
      )}

      {displayInfo.notes && <p className="mt-3 text-sm text-muted">{displayInfo.notes}</p>}

      {warmup && (
        <p className="mt-3 text-sm text-muted">
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
              className={`rounded-block border p-3 ${done ? "border-success bg-success/5" : "border-border"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink">
                  Serie {i + 1} · objetivo {set.reps} reps
                  {set.targetRIR !== "-" ? ` · RIR ${set.targetRIR}` : ""}
                </span>
                {done && (
                  <span className="rounded-pill border border-success/35 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    Confirmado
                  </span>
                )}
              </div>
              {lastTime && (
                <p className="mb-2 font-mono text-xs text-muted">
                  última vez: {lastTime.weightKg}kg × {lastTime.reps}, RIR {lastTime.rir}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-faint">Peso (kg)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    value={logged.weightKg ?? ""}
                    onChange={(e) =>
                      updateSet(i, { weightKg: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="h-12 w-full rounded-pill border border-border bg-surface2 px-3 font-mono text-lg font-semibold text-ink"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-faint">Reps</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    value={logged.reps ?? ""}
                    onChange={(e) =>
                      updateSet(i, { reps: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="h-12 w-full rounded-pill border border-border bg-surface2 px-3 font-mono text-lg font-semibold text-ink"
                  />
                </label>
              </div>

              {suggestion && logged.weightKg === null && (
                <button
                  type="button"
                  onClick={() => updateSet(i, { weightKg: suggestion.weightKg })}
                  className="mt-2 font-mono text-xs font-medium text-primary"
                >
                  Sugerido: {suggestion.weightKg}kg ({suggestion.reason})
                </button>
              )}

              {isNewPR && (
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent">
                  <IconTrophy className="h-3.5 w-3.5" />
                  Nuevo récord personal
                </p>
              )}

              <div className="mt-3">
                <span className="mb-1 block text-xs text-faint">RIR</span>
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
                className={`mt-3 w-full rounded-pill py-2 text-sm font-semibold transition-colors ${
                  done ? "bg-success text-white" : "bg-surface2 text-faint disabled:opacity-50"
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
        <div className="mt-4 border-t border-border pt-3">
          <button type="button" onClick={() => setShowSubs((s) => !s)} className="text-sm font-medium text-muted">
            {showSubs ? "Ocultar sustituciones" : "¿No tenés el equipo? Ver sustituciones"}
          </button>
          {showSubs && (
            <div className="mt-2 flex flex-wrap gap-2">
              {isSubstituted && (
                <button
                  type="button"
                  onClick={() => substituteExercise(null)}
                  className="rounded-pill border border-primary/35 bg-primary/10 px-3 py-1 text-sm text-primary"
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
                    className="rounded-pill border border-border bg-surface2 px-3 py-1 text-sm text-faint"
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
