import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ExerciseGroup } from "../types/program";
import type { LoggedSet, RIRValue, TechniqueExtra, WorkoutSession } from "../types/logs";
import { isSetFilled, isSetLogged, rirToNumber } from "../types/logs";
import { estimatedE1RM } from "../lib/e1rm";
import { RIRSelector } from "./RIRSelector";
import { NumericInput } from "./NumericInput";
import { VideoEmbed } from "./VideoEmbed";
import { RestTimer } from "./RestTimer";
import { ProgressChart } from "./ProgressChart";
import { IconNote, IconTrophy } from "./icons";
import { useApp } from "../context/AppContext";
import { getExerciseProgression } from "../lib/history";
import { getCurrentNote, noteEntryId } from "../lib/exerciseNotes";
import { getLiteralWorkingSets } from "../lib/program";
import { getIncrementKg } from "../lib/increments";
import { buildWeightSuggestions, type WeightSuggestion } from "../lib/suggestions";
import { getWarmupSuggestion, type WarmupSuggestion } from "../lib/warmup";
import { WARMUP_CONFIG } from "../lib/warmupConfig";
import { emptyDrop, emptyMiniSet, getDropSetWeightSuggestions, matchTechnique } from "../lib/techniques";
import { TECHNIQUE_CONFIG } from "../lib/techniqueConfig";
import type { TechniqueCatalogEntry } from "../lib/techniqueConfig";
import { getPersonalRecord, getE1rmRecord, getPersonalRecordInRepRange } from "../lib/records";
import { matchExerciseReferences, type SetReference } from "../lib/exerciseReference";
import { globalSeq } from "../lib/cycle";
import { unlockAudio, vibrate } from "../lib/feedback";
import { withVariantChoice } from "../lib/variants";

interface Props {
  group: ExerciseGroup;
  groupIndexInDay: number;
  programIndex: number;
  active: boolean;
  onActivate: () => void;
  /** Se llama cuando se confirma la última serie pendiente de este ejercicio. */
  onExerciseCompleted: () => void;
  session: WorkoutSession;
  onUpdateSession: (updater: (session: WorkoutSession) => WorkoutSession) => void;
}

function summarizeSets(group: ExerciseGroup): string {
  const literal = getLiteralWorkingSets(group);
  if (literal.length === 0) return "";
  return `${literal.length} serie${literal.length > 1 ? "s" : ""} · ${literal[0].reps} reps`;
}

interface SetBlockProps {
  index: number;
  reps: string;
  targetRIR: string;
  logged: LoggedSet;
  reference: SetReference;
  suggestion: WeightSuggestion | null;
  filled: boolean;
  done: boolean;
  isNewPR: boolean;
  restTimer?: ReactNode;
  /** Técnica de intensidad de esta serie (solo la última serie de trabajo del ejercicio puede tenerla), o null. */
  technique: TechniqueCatalogEntry | null;
  incrementKg: number;
  onChangeWeight: (weightKg: number | null) => void;
  onChangeReps: (reps: number | null) => void;
  onChangeRir: (rir: RIRValue) => void;
  onChangeTechnique: (extra: TechniqueExtra | null) => void;
  onConfirm: () => void;
}

function SetBlock({
  index,
  reps,
  targetRIR,
  logged,
  reference,
  suggestion,
  filled,
  done,
  isNewPR,
  restTimer,
  technique,
  incrementKg,
  onChangeWeight,
  onChangeReps,
  onChangeRir,
  onChangeTechnique,
  onConfirm,
}: SetBlockProps) {
  return (
    <div className={`rounded-block border p-3 ${done ? "border-success bg-success/5" : "border-border"}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">
          Serie {index + 1} · objetivo {reps} reps
          {targetRIR !== "-" ? ` · RIR ${targetRIR}` : ""}
        </span>
        {done && (
          <span className="rounded-pill border border-success/35 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
            Confirmado
          </span>
        )}
      </div>
      <div className="mb-2">
        {reference.set ? (
          <>
            <p className="font-mono text-xs text-muted">
              última vez: {reference.set.weightKg}kg × {reference.set.reps}, RIR {reference.set.rir}
            </p>
            <p className={`text-[11px] ${reference.tier === "same-day" ? "text-faint" : "text-warning"}`}>
              {reference.dayName} · S{reference.weekNumber} · {reference.set.reps} reps
              {reference.tier === "other-day" && " · otra rutina"}
              {reference.tier === "approx" && " · aproximada"}
            </p>
          </>
        ) : (
          <p className="font-mono text-xs text-faint">última vez: sin datos</p>
        )}
      </div>

      {restTimer && <div className="mb-3">{restTimer}</div>}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Peso (kg)</span>
          <NumericInput
            value={logged.weightKg}
            onChange={onChangeWeight}
            allowDecimal
            className="h-12 w-full rounded-pill border border-border bg-surface2 px-3 font-mono text-lg font-semibold text-ink"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-faint">Reps</span>
          <NumericInput
            value={logged.reps}
            onChange={onChangeReps}
            allowDecimal={false}
            className="h-12 w-full rounded-pill border border-border bg-surface2 px-3 font-mono text-lg font-semibold text-ink"
          />
        </label>
      </div>

      {suggestion && logged.weightKg === null && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onChangeWeight(suggestion.weightKg)}
            className="font-mono text-xs font-medium text-primary"
          >
            {suggestion.mode === "raise" && (
              <>
                Sugerido: {suggestion.weightKg}kg
                {suggestion.estimatedReps && ` · ~${suggestion.estimatedReps.min}-${suggestion.estimatedReps.max} reps`}
              </>
            )}
            {suggestion.mode === "hold" && <>Mantener: {suggestion.weightKg}kg</>}
            {suggestion.mode === "step-down" && <>Bajar a: {suggestion.weightKg}kg</>}
            {" "}
            ({suggestion.reason})
          </button>
          {suggestion.extendedRange && (
            <p className="mt-0.5 text-[11px] text-faint">
              Rango de hoy: {reps} · buscá {suggestion.extendedRange.min}-{suggestion.extendedRange.max} reps con{" "}
              {suggestion.weightKg}kg
            </p>
          )}
        </div>
      )}

      {isNewPR && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent">
          <IconTrophy className="h-3.5 w-3.5" />
          Nuevo récord personal
        </p>
      )}

      <div className="mt-3">
        <span className="mb-1 block text-xs text-faint">RIR</span>
        <RIRSelector value={logged.rir} onChange={onChangeRir} />
      </div>

      {technique && done && (
        <TechniqueSection
          entry={technique}
          mainWeightKg={logged.weightKg}
          incrementKg={incrementKg}
          extra={logged.technique ?? null}
          onChange={onChangeTechnique}
        />
      )}

      <button
        type="button"
        disabled={!filled}
        onClick={onConfirm}
        className={`mt-3 w-full rounded-pill py-2 text-sm font-semibold transition-colors ${
          done ? "bg-success text-white" : "bg-surface2 text-faint disabled:opacity-50"
        }`}
      >
        {done ? "✓ Serie confirmada" : "Confirmar serie ✓"}
      </button>
    </div>
  );
}

/**
 * Nota de calentamiento sugerido: se tilda a mano (sin persistir, es solo una
 * guía) y no afecta volumen/tonelaje/e1RM/PRs/referencias — esas series nunca
 * se loguean como series de trabajo.
 */
function WarmupNote({ suggestion }: { suggestion: WarmupSuggestion }) {
  const [expanded, setExpanded] = useState(true);
  const [done, setDone] = useState<boolean[]>(() => suggestion.sets.map(() => false));

  return (
    <div className="mt-3 rounded-block border border-border bg-surface2 p-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-ink"
      >
        <span>
          Calentamiento sugerido · {suggestion.countLabel} serie{suggestion.countLabel !== "1" ? "s" : ""}
          {suggestion.optional && " (opcional)"}
        </span>
        <span className="text-xs font-normal text-faint">{expanded ? "ocultar" : "ver"}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {suggestion.sets.map((s, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={done[i] ?? false}
                onChange={() => setDone((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
                className="h-4 w-4 shrink-0 rounded border-border accent-primary"
              />
              <span className={`font-mono ${done[i] ? "text-faint line-through" : "text-ink"}`}>
                {s.weightKg}kg <span className="text-faint">· {Math.round(s.pct * 100)}%</span>
              </span>
            </label>
          ))}
          <p className="text-[11px] text-faint">
            Descanso {WARMUP_CONFIG.restSeconds.min}-{WARMUP_CONFIG.restSeconds.max}s entre series de calentamiento.
          </p>
        </div>
      )}
    </div>
  );
}

/** Cuenta regresiva simple en segundos; `onDone` se llama una sola vez al llegar a 0. */
function useCountdown(onDone?: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => (r !== null ? r - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  useEffect(() => {
    if (remaining === 0) onDoneRef.current?.();
  }, [remaining]);

  return { remaining, start: (seconds: number) => setRemaining(seconds) };
}

/**
 * Logueo de la técnica de intensidad (fase 6) de la ÚLTIMA serie de trabajo
 * de un ejercicio — nunca de toda la serie: son datos "extra" que se
 * guardan aparte y nunca pisan la serie principal (peso/reps/rir al fallo,
 * ya logueados arriba), que sigue siendo la única base de e1RM/PR/
 * sugerencia/referencia/alertas.
 */
function TechniqueSection({
  entry,
  mainWeightKg,
  incrementKg,
  extra,
  onChange,
}: {
  entry: TechniqueCatalogEntry;
  mainWeightKg: number | null;
  incrementKg: number;
  extra: TechniqueExtra | null;
  onChange: (extra: TechniqueExtra | null) => void;
}) {
  const holdCountdown = useCountdown(() => {
    if (entry.kind !== "static-hold") return;
    onChange({ kind: "static-hold", weightKg: extra?.kind === "static-hold" ? extra.weightKg : null, seconds: TECHNIQUE_CONFIG.staticHold.seconds });
  });
  const restCountdown = useCountdown();

  return (
    <div className="mt-3 rounded-block border border-primary/30 bg-primary/5 p-3">
      <p className="text-sm font-semibold text-primary">{entry.label}</p>
      <p className="mt-0.5 text-xs text-muted">{entry.description}</p>

      {entry.kind === "drop-sets" && (
        <div className="mt-2 space-y-2">
          {TECHNIQUE_CONFIG.dropSets.weightPcts.map((pct, i) => {
            const current = extra?.kind === "drop-sets" ? extra.drops[i] : null;
            const suggested = mainWeightKg !== null ? getDropSetWeightSuggestions(mainWeightKg, incrementKg)[i] : null;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-12 shrink-0 font-mono text-xs text-faint">~{Math.round(pct * 100)}%</span>
                <NumericInput
                  value={current?.weightKg ?? null}
                  onChange={(weightKg) => {
                    const base = extra?.kind === "drop-sets" ? extra.drops : [emptyDrop(), emptyDrop()];
                    const drops = base.map((d, idx) => (idx === i ? { ...d, weightKg } : d));
                    onChange({ kind: "drop-sets", drops });
                  }}
                  allowDecimal
                  className="h-9 w-20 rounded-pill border border-border bg-surface2 px-2 text-center font-mono text-sm text-ink"
                />
                {suggested !== null && (current?.weightKg ?? null) === null && (
                  <button
                    type="button"
                    onClick={() => {
                      const base = extra?.kind === "drop-sets" ? extra.drops : [emptyDrop(), emptyDrop()];
                      const drops = base.map((d, idx) => (idx === i ? { ...d, weightKg: suggested } : d));
                      onChange({ kind: "drop-sets", drops });
                    }}
                    className="whitespace-nowrap text-[11px] font-medium text-primary"
                  >
                    usar {suggested}kg
                  </button>
                )}
                <span className="text-xs text-faint">×</span>
                <NumericInput
                  value={current?.reps ?? null}
                  onChange={(reps) => {
                    const base = extra?.kind === "drop-sets" ? extra.drops : [emptyDrop(), emptyDrop()];
                    const drops = base.map((d, idx) => (idx === i ? { ...d, reps } : d));
                    onChange({ kind: "drop-sets", drops });
                  }}
                  allowDecimal={false}
                  className="h-9 w-16 rounded-pill border border-border bg-surface2 px-2 text-center font-mono text-sm text-ink"
                />
                <span className="text-xs text-faint">reps</span>
              </div>
            );
          })}
        </div>
      )}

      {entry.kind === "partials" && (
        <div className="mt-2 flex items-center gap-2">
          <NumericInput
            value={extra?.kind === "partials" ? extra.partialReps : null}
            onChange={(partialReps) => onChange({ kind: "partials", partialReps })}
            allowDecimal={false}
            className="h-9 w-16 rounded-pill border border-border bg-surface2 px-2 text-center font-mono text-sm text-ink"
          />
          <span className="text-xs text-faint">reps parciales</span>
        </div>
      )}

      {entry.kind === "myo-reps" && (
        <div className="mt-2 space-y-2">
          {(extra?.kind === "myo-reps" ? extra.miniSets : []).map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-faint">mini {i + 1}</span>
              <NumericInput
                value={m.reps}
                onChange={(reps) => {
                  const miniSets = (extra?.kind === "myo-reps" ? extra.miniSets : []).map((s, idx) =>
                    idx === i ? { reps } : s
                  );
                  onChange({ kind: "myo-reps", miniSets });
                }}
                allowDecimal={false}
                className="h-9 w-16 rounded-pill border border-border bg-surface2 px-2 text-center font-mono text-sm text-ink"
              />
              <span className="text-xs text-faint">reps</span>
            </div>
          ))}
          {(() => {
            const miniSets = extra?.kind === "myo-reps" ? extra.miniSets : [];
            const lastMini = miniSets[miniSets.length - 1];
            const stopped = lastMini && lastMini.reps !== null && lastMini.reps < TECHNIQUE_CONFIG.myoReps.stopBelowReps;
            if (stopped) return <p className="text-xs text-faint">Listo: esa mini-serie ya dio menos de {TECHNIQUE_CONFIG.myoReps.stopBelowReps} reps.</p>;
            if (restCountdown.remaining !== null && restCountdown.remaining > 0) {
              return <p className="font-mono text-sm text-primary">Descansando... {restCountdown.remaining}s</p>;
            }
            return (
              <button
                type="button"
                onClick={() => {
                  onChange({ kind: "myo-reps", miniSets: [...miniSets, emptyMiniSet()] });
                  restCountdown.start(TECHNIQUE_CONFIG.myoReps.restSeconds);
                }}
                className="text-sm font-medium text-primary"
              >
                + mini-serie (descansá {TECHNIQUE_CONFIG.myoReps.restSeconds}s)
              </button>
            );
          })()}
        </div>
      )}

      {entry.kind === "static-hold" && (
        <div className="mt-2 flex items-center gap-3">
          <NumericInput
            value={extra?.kind === "static-hold" ? extra.weightKg : null}
            onChange={(weightKg) => onChange({ kind: "static-hold", weightKg, seconds: extra?.kind === "static-hold" ? extra.seconds : null })}
            allowDecimal
            className="h-9 w-16 rounded-pill border border-border bg-surface2 px-2 text-center font-mono text-sm text-ink"
          />
          <span className="text-xs text-faint">kg</span>
          {holdCountdown.remaining === null ? (
            <button
              type="button"
              onClick={() => holdCountdown.start(TECHNIQUE_CONFIG.staticHold.seconds)}
              className="text-sm font-medium text-primary"
            >
              Arrancar plancha ({TECHNIQUE_CONFIG.staticHold.seconds}s)
            </button>
          ) : holdCountdown.remaining > 0 ? (
            <p className="font-mono text-sm text-primary">{holdCountdown.remaining}s</p>
          ) : (
            <p className="text-sm font-medium text-success">¡Listo!</p>
          )}
          {extra?.kind === "static-hold" && extra.seconds !== null && (
            <span className="text-xs text-faint">{extra.seconds}s sostenidos</span>
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseNotes({
  currentText,
  fallbackText,
  fallbackExerciseName,
  onSave,
}: {
  /** La nota vigente de este ejercicio (variante), si tiene. */
  currentText: string | null;
  /** La nota del ejercicio original, para mostrar como referencia si la variante no tiene una propia. */
  fallbackText: string | null;
  fallbackExerciseName: string | null;
  onSave: (text: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentText ?? "");

  if (!editing) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => {
            setDraft(currentText ?? "");
            setEditing(true);
          }}
          className="text-sm font-medium text-primary"
        >
          {currentText ? "Editar notas" : "Agregar notas"}
        </button>
        {currentText && <p className="mt-1 whitespace-pre-line text-sm text-muted">{currentText}</p>}
        {!currentText && fallbackText && (
          <p className="mt-1 text-sm text-muted">
            <span className="text-faint">Notas de {fallbackExerciseName} (ejercicio original): </span>
            {fallbackText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Notas para este ejercicio..."
        className="w-full rounded-block border border-border bg-surface2 p-2 text-sm text-ink"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onSave(draft.trim() === "" ? null : draft.trim());
            setEditing(false);
          }}
          className="flex-1 rounded-pill bg-primary py-1.5 text-xs font-semibold text-white"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 rounded-pill bg-surface2 py-1.5 text-xs font-semibold text-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function ExerciseCard({
  group,
  groupIndexInDay,
  programIndex,
  active,
  onActivate,
  onExerciseCompleted,
  session,
  onUpdateSession,
}: Props) {
  const { logs, program, flatDays, settings, updateSettings, upsertExerciseNoteEntry, exerciseInfoIndex } = useApp();
  const [showSubs, setShowSubs] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const literalSets = useMemo(() => getLiteralWorkingSets(group), [group]);
  const warmup = group.sets.find((s) => s.type === "warmup");
  // La técnica de intensidad (columna D) se aplica solo sobre la última serie de trabajo, nunca sobre todo el grupo (fase 6).
  const techniqueEntry = useMemo(() => matchTechnique(group.intensityTechnique), [group.intensityTechnique]);
  const lastWorkingSetIdx = literalSets.length - 1;
  const beforeGlobalSeq = globalSeq({ programIndex, cycle: session.cycle });

  const loggedExercise = session.exercises[groupIndexInDay];
  const displayName = loggedExercise?.exercise ?? group.exercise;
  const isSubstituted = Boolean(loggedExercise?.originalExercise);
  const allLogged = loggedExercise?.sets.every(isSetLogged) ?? false;
  const incrementKg = getIncrementKg(settings.exerciseIncrements, displayName);
  const pr = useMemo(() => getPersonalRecord(logs, displayName), [logs, displayName]);
  const e1rmRecord = useMemo(() => getE1rmRecord(logs, displayName), [logs, displayName]);
  // PR por cada rango de reps distinto que pide esta rutina, una vez por ejercicio (no por serie).
  const prsByRepRange = useMemo(() => {
    const uniqueReps = [...new Set(literalSets.map((s) => s.reps))];
    return uniqueReps
      .map((reps) => ({ reps, pr: getPersonalRecordInRepRange(logs, displayName, reps) }))
      .filter((r): r is { reps: string; pr: NonNullable<typeof r.pr> } => r.pr !== null);
  }, [literalSets, logs, displayName]);
  const referencesBySet = useMemo(
    () =>
      matchExerciseReferences(logs, flatDays, program, displayName, session.dayName, literalSets.map((s) => s.reps), beforeGlobalSeq, 2),
    [logs, flatDays, program, displayName, session.dayName, literalSets, beforeGlobalSeq]
  );
  const suggestions = useMemo(
    () => buildWeightSuggestions(literalSets, referencesBySet[0].map((r) => r.set), incrementKg),
    [literalSets, referencesBySet, incrementKg]
  );
  // Peso de referencia para el calentamiento: la sugerencia de hoy para la primera serie de trabajo si existe, o si no el peso de la última vez (fase 1).
  const warmupReferenceWeightKg = suggestions[0]?.weightKg ?? referencesBySet[0][0]?.set?.weightKg ?? null;
  const warmupSuggestion = useMemo(
    () => getWarmupSuggestion(group, warmupReferenceWeightKg, incrementKg),
    [group, warmupReferenceWeightKg, incrementKg]
  );
  const progression = useMemo(
    () => getExerciseProgression(logs, program, displayName, 0, session.dayName),
    [logs, program, displayName, session.dayName]
  );
  const currentNoteEntry = useMemo(() => getCurrentNote(logs, displayName), [logs, displayName]);
  const fallbackNoteEntry = useMemo(
    () => (isSubstituted && !currentNoteEntry ? getCurrentNote(logs, group.exercise) : null),
    [isSubstituted, currentNoteEntry, logs, group.exercise]
  );
  const substitutionInfo = isSubstituted
    ? group.substitutions.find((s) => s.name === displayName) ?? null
    : null;
  const fallbackInfo = isSubstituted ? exerciseInfoIndex[displayName] : null;
  // Si el sustituto no tiene su propia descripción, mantenemos al menos la del ejercicio original en vez de ocultarla.
  const displayInfo = isSubstituted
    ? {
        videoUrl: substitutionInfo?.videoUrl ?? fallbackInfo?.videoUrl ?? null,
        notes: fallbackInfo?.notes ?? group.notes ?? null,
      }
    : { videoUrl: group.videoUrl, notes: group.notes };

  function updateSet(setIndex: number, patch: Partial<LoggedSet>, exercisePatch?: Partial<WorkoutSession["exercises"][number]>) {
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
        return { ...ex, sets, ...exercisePatch };
      });
      return { ...prev, exercises, updatedAt: new Date().toISOString() };
    });
  }

  /** A diferencia de `updateSet`, nunca invalida la confirmación: la técnica se carga después de confirmar la serie principal. */
  function updateSetTechnique(setIndex: number, technique: TechniqueExtra | null) {
    onUpdateSession((prev) => {
      const exercises = prev.exercises.map((ex, idx) => {
        if (idx !== groupIndexInDay) return ex;
        const sets = ex.sets.map((s) => (s.setIndex === setIndex ? { ...s, technique } : s));
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
          notes: null,
          sets: ex.sets.map((s) => ({ ...s, weightKg: null, reps: null, rir: null, confirmed: false })),
        };
      });
      return { ...prev, exercises, updatedAt: new Date().toISOString() };
    });
    // Queda como la variante predeterminada de este ejercicio en todo el programa, no solo en esta sesión.
    updateSettings({ exerciseVariantDefaults: withVariantChoice(settings, group.exercise, newName) });
    setShowSubs(false);
  }

  function saveExerciseNote(text: string | null) {
    const now = new Date().toISOString();
    upsertExerciseNoteEntry({
      id: noteEntryId(session, displayName),
      exercise: displayName,
      text: text ?? "",
      date: session.completedAt ?? session.startedAt,
      weekNumber: session.weekNumber,
      sessionId: session.id,
      createdAt: currentNoteEntry?.createdAt ?? now,
      updatedAt: now,
    });
  }

  function confirmSet(setIndex: number, logged: LoggedSet) {
    const nowConfirmed = !logged.confirmed;
    updateSet(setIndex, { confirmed: nowConfirmed }, nowConfirmed ? { restStartedAt: new Date().toISOString() } : undefined);
    if (nowConfirmed) {
      vibrate(20);
      unlockAudio();
      const otherSets = loggedExercise?.sets.filter((s) => s.setIndex !== setIndex) ?? [];
      if (otherSets.every(isSetLogged)) onExerciseCompleted();
    }
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className="flex w-full items-center justify-between rounded-card border border-border bg-surface px-4 py-3 text-left"
      >
        <div>
          <p className="flex items-center gap-1.5 font-medium text-ink">
            {displayName}
            {isSubstituted && <span className="text-xs font-normal text-warning">sustituto</span>}
            {Boolean(currentNoteEntry?.text?.trim()) && (
              <IconNote className="h-3.5 w-3.5 shrink-0 text-faint" aria-label="Tiene notas" />
            )}
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
          {techniqueEntry && (
            <p className="text-sm font-medium text-primary">{techniqueEntry.label} en la última serie</p>
          )}
          {prsByRepRange.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <IconTrophy className="h-3.5 w-3.5 text-accent" />
              <span className="font-mono">
                {prsByRepRange.map(({ reps, pr: r }, i) => (
                  <span key={reps}>
                    {i > 0 && " · "}
                    PR {reps} reps: {r.weightKg}kg × {r.reps}
                  </span>
                ))}
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
          <p className="text-sm text-faint">Sin video de técnica disponible para este sustituto.</p>
        )
      )}

      {displayInfo.notes && <p className="mt-3 text-sm text-muted">{displayInfo.notes}</p>}

      <ExerciseNotes
        currentText={currentNoteEntry?.text?.trim() ? currentNoteEntry.text : null}
        fallbackText={fallbackNoteEntry?.text?.trim() ? fallbackNoteEntry.text : null}
        fallbackExerciseName={isSubstituted ? group.exercise : null}
        onSave={saveExerciseNote}
      />

      {warmup &&
        (warmupSuggestion ? (
          <WarmupNote suggestion={warmupSuggestion} />
        ) : (
          <p className="mt-3 text-sm text-muted">
            Calentamiento: {warmup.count} serie{warmup.count !== "1" ? "s" : ""} livianas (todavía sin datos para
            sugerir el peso)
          </p>
        ))}

      <div className="mt-4 space-y-4">
        {(() => {
          const setViews = literalSets.map((set, i) => {
            const logged = loggedExercise?.sets.find((s) => s.setIndex === i) ?? {
              setIndex: i,
              weightKg: null,
              reps: null,
              rir: null,
              confirmed: false,
            };
            const done = isSetLogged(logged);
            return { set, i, logged, done };
          });
          const firstPendingIdx = setViews.findIndex((v) => !v.done);

          return setViews.map(({ set, i, logged, done }) => {
            const reference = referencesBySet[0][i];
            const suggestion = suggestions[i];
            const filled = isSetFilled(logged);
            const isWeightPR = filled && logged.weightKg !== null && (!pr || logged.weightKg > pr.weightKg);
            const isE1rmPR =
              filled &&
              logged.weightKg !== null &&
              logged.reps !== null &&
              logged.rir !== null &&
              (!e1rmRecord ||
                estimatedE1RM(logged.weightKg, logged.reps, rirToNumber(logged.rir)) > e1rmRecord.e1rm);
            const isNewPR = isWeightPR || isE1rmPR;
            // El descanso arranca al confirmar una serie, así que se muestra arriba del peso/reps de la próxima pendiente.
            const showRestTimer = i === firstPendingIdx && Boolean(loggedExercise?.restStartedAt);

            return (
              <SetBlock
                key={i}
                index={i}
                reps={set.reps}
                targetRIR={set.targetRIR}
                logged={logged}
                reference={reference}
                suggestion={suggestion}
                filled={filled}
                done={done}
                isNewPR={isNewPR}
                restTimer={
                  showRestTimer ? (
                    <RestTimer restStartedAt={loggedExercise?.restStartedAt ?? null} targetLabel={group.rest} />
                  ) : undefined
                }
                technique={i === lastWorkingSetIdx ? techniqueEntry : null}
                incrementKg={incrementKg}
                onChangeWeight={(weightKg) => updateSet(i, { weightKg })}
                onChangeReps={(reps) => updateSet(i, { reps })}
                onChangeRir={(rir) => updateSet(i, { rir })}
                onChangeTechnique={(technique) => updateSetTechnique(i, technique)}
                onConfirm={() => confirmSet(i, logged)}
              />
            );
          });
        })()}
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
                .filter((sub) => sub.name !== displayName)
                .map((sub) => (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => substituteExercise(sub.name)}
                    className="rounded-pill border border-border bg-surface2 px-3 py-1 text-sm text-faint"
                  >
                    {sub.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
