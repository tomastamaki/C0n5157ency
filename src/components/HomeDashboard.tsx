import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { useWorkoutActions } from "../lib/useWorkoutActions";
import type { WeekDayStatus } from "../lib/schedule";
import type { WorkoutSession } from "../types/logs";
import {
  countPRsInSession,
  getAttentionFlags,
  getCurrentStreak,
  getGreeting,
  getHighlightExercise,
  getLastCompletedSession,
  getMuscleChips,
  getWeeksUntilDeload,
} from "../lib/insights";
import { formatDate, formatDuration, localDateKey } from "../lib/time";
import { getRecommendation } from "../lib/recommendation";
import { getMetricKpis } from "../lib/habitMetricsKpis";
import { getPeriodData, getExerciseRows, getPerformanceVariation } from "../lib/periodSummary";
import type { HabitMetricKind } from "../types/habits";
import { IconFlame, IconTrophy } from "./icons";
import { ActiveWorkoutBanner } from "./ActiveWorkoutBanner";
import { RecommendationCard } from "./RecommendationCard";
import { LifestyleKpiRow } from "./LifestyleKpiRow";
import { HabitsTodayCard } from "./habits/HabitsTodayCard";
import { VariationPill } from "./VariationPill";
import { WorkoutPreviewScreen } from "../screens/WorkoutPreview";
import { PeriodSummaryScreen } from "../screens/PeriodSummary";
import { PRDetailView } from "./PRDetailView";

interface Props {
  weekDays: WeekDayStatus[];
  activeDraft: WorkoutSession | null;
  onNavigateHistory: () => void;
  /** Se llama después de empezar un entrenamiento nuevo o al tocar el banner de "retomar". */
  onEnterWorkout: () => void;
  /** Lleva a la pestaña Hábitos, directo al Detalle de ese hábito nativo de Métricas. */
  onNavigateToMetric: (metricKind: HabitMetricKind) => void;
  /** Lleva a la pestaña Hábitos. */
  onNavigateToHabits: () => void;
}

export function HomeDashboard({
  weekDays,
  activeDraft,
  onNavigateHistory,
  onEnterWorkout,
  onNavigateToMetric,
  onNavigateToHabits,
}: Props) {
  const { logs, program, settings, flatDays } = useApp();
  const { startWorkout, skipDay } = useWorkoutActions();
  const cycle = settings.programCycle;
  const [showSummary, setShowSummary] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPRs, setShowPRs] = useState(false);

  const pendingDays = weekDays.filter((d) => !d.session);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = pendingDays[Math.min(selectedIdx, pendingDays.length - 1)];

  const currentWeekNumber = weekDays[0]?.flatDay.weekNumber ?? 1;
  const weekSummary = useMemo(
    () => getPeriodData(logs, program, cycle, currentWeekNumber),
    [logs, program, cycle, currentWeekNumber]
  );
  const weekRows = useMemo(
    () => getExerciseRows(logs, program, flatDays, cycle, currentWeekNumber),
    [logs, program, flatDays, cycle, currentWeekNumber]
  );
  const weekPerf = useMemo(() => getPerformanceVariation(weekRows), [weekRows]);

  const streak = useMemo(() => getCurrentStreak(logs, cycle), [logs, cycle]);
  const attention = useMemo(() => getAttentionFlags(logs, cycle, program, flatDays), [logs, cycle, program, flatDays]);
  const highlight = useMemo(
    () => getHighlightExercise(logs, cycle, program, flatDays),
    [logs, cycle, program, flatDays]
  );
  const lastSession = useMemo(() => getLastCompletedSession(logs, cycle), [logs, cycle]);
  const lastSessionPRs = useMemo(
    () => (lastSession ? countPRsInSession(logs, lastSession) : 0),
    [logs, lastSession]
  );

  const weeksUntilDeload = getWeeksUntilDeload(program, currentWeekNumber);

  const chips = selected ? getMuscleChips(selected.flatDay) : [];

  const recommendation = useMemo(
    () =>
      selected
        ? getRecommendation(logs, program, flatDays, selected.flatDay.day.name, selected.flatDay.weekNumber, cycle)
        : null,
    [logs, program, flatDays, selected, cycle]
  );

  const metricKpis = useMemo(() => getMetricKpis(logs.habits, logs.habitLogs, localDateKey(new Date())), [logs]);

  if (showSummary) {
    return <PeriodSummaryScreen onBack={() => setShowSummary(false)} />;
  }

  if (showPRs) {
    return <PRDetailView currentWeekNumber={currentWeekNumber} cycle={cycle} onBack={() => setShowPRs(false)} />;
  }

  if (showPreview && selected) {
    return (
      <WorkoutPreviewScreen
        flatDay={selected.flatDay}
        onBack={() => setShowPreview(false)}
        onStart={() => {
          startWorkout(selected.flatDay);
          onEnterWorkout();
        }}
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">{getGreeting()}</h1>
        {streak > 0 && (
          <div className="flex items-center gap-1 text-sm font-semibold text-accent">
            <IconFlame className="h-[18px] w-[18px]" />
            <span className="font-mono">{streak}</span>
          </div>
        )}
      </div>

      <HabitsTodayCard logs={logs} onNavigate={onNavigateToHabits} />

      <LifestyleKpiRow kpis={metricKpis} onSelect={onNavigateToMetric} />

      <button
        type="button"
        onClick={() => setShowSummary(true)}
        className="w-full rounded-card border border-border bg-surface p-4 text-left shadow-elevated-sm"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Tu semana</p>
          <span className="text-xs text-primary">Ver resumen →</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="font-mono text-xl font-bold text-ink">
              {weekSummary.sessionsCompleted}/{weekSummary.sessionsPlanned}
            </p>
            <p className="text-xs text-faint">sesiones</p>
          </div>
          <div>
            <p className="font-mono text-xl font-bold text-ink">
              {Math.round(weekSummary.tonnageKg).toLocaleString("es-AR")}kg
            </p>
            <p className="text-xs text-faint">tonelaje</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted">
            RIR prom. {weekSummary.avgRir !== null ? weekSummary.avgRir.toFixed(1) : "—"}
          </span>
          {weekSummary.isDeload ? (
            <span className="rounded-pill bg-surface2 px-2 py-0.5 text-xs font-medium text-muted">deload</span>
          ) : (
            <VariationPill pct={weekPerf.vsAnterior} />
          )}
        </div>
        {highlight && (
          <p className="mt-2 text-xs text-success">
            ★ {highlight.exercise} +{highlight.pct.toFixed(0)}%
          </p>
        )}
      </button>

      <button
        type="button"
        onClick={() => setShowPRs(true)}
        className="-mt-2 flex items-center gap-1 text-xs text-primary"
      >
        <IconTrophy className="h-3.5 w-3.5" />
        Ver todos los PRs →
      </button>

      {activeDraft && <ActiveWorkoutBanner draft={activeDraft} onResume={onEnterWorkout} />}

      {!activeDraft && selected && (
        <div className="rounded-card border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 shadow-elevated">
          <p className="text-sm text-muted">
            {selected.flatDay.blockName} · Semana {selected.flatDay.weekNumber} de {selected.flatDay.totalWeeks}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-ink">{selected.flatDay.day.name}</h2>
          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span key={c} className="rounded-pill bg-surface2 px-2 py-0.5 text-xs text-muted">
                  {c}
                </span>
              ))}
            </div>
          )}

          {recommendation && <RecommendationCard recommendation={recommendation} />}

          <button
            type="button"
            onClick={() => {
              startWorkout(selected.flatDay);
              onEnterWorkout();
            }}
            className="mt-1 w-full rounded-pill bg-primary py-3 text-base font-semibold text-white shadow-elevated-sm active:scale-[0.98]"
          >
            Empezar entrenamiento
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="mt-2 w-full text-sm text-primary underline"
          >
            Vista previa del entrenamiento
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `¿Marcar "${selected.flatDay.day.name}" (semana ${selected.flatDay.weekNumber}) como salteado?`
                )
              ) {
                skipDay(selected.flatDay);
              }
            }}
            className="mt-2 w-full text-sm text-faint underline"
          >
            Saltear este día
          </button>

          {weekDays.length > 1 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs text-muted">Días de esta semana · elegí cuál hacer</p>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((d, i) => {
                  const pendingIdx = pendingDays.indexOf(d);
                  const isDone = Boolean(d.session);
                  const isSelected = !isDone && selected.flatDay.index === d.flatDay.index;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={isDone}
                      onClick={() => pendingIdx >= 0 && setSelectedIdx(pendingIdx)}
                      className={`rounded-pill px-3 py-1.5 text-sm font-medium ${
                        isDone
                          ? "bg-success/10 text-success"
                          : isSelected
                            ? "bg-primary text-white"
                            : "bg-surface2 text-muted"
                      }`}
                    >
                      {d.flatDay.day.name}
                      {isDone && " ✓"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {attention.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">Necesita atención</p>
          {attention.map((flag, i) => (
            <div key={i} className="rounded-block border-l-[3px] border-l-warning bg-surface p-3 shadow-elevated-sm">
              <p className="text-sm font-medium text-ink">
                {flag.exercise} <span className="text-xs font-normal text-faint">· {flag.kind === "stalled" ? "estancado" : "a vigilar"}</span>
              </p>
              <p className="text-xs text-muted">{flag.detail}</p>
            </div>
          ))}
        </div>
      )}

      {weeksUntilDeload !== null && weeksUntilDeload > 0 && (
        <p className="text-center text-xs text-faint">
          {weeksUntilDeload === 1
            ? "La próxima semana es de deload"
            : `${weeksUntilDeload} semanas para tu próximo deload`}
        </p>
      )}

      {lastSession && (
        <button
          type="button"
          onClick={onNavigateHistory}
          className="w-full rounded-card border border-border bg-surface p-4 text-left shadow-elevated-sm"
        >
          <p className="text-sm font-semibold text-ink">Último entrenamiento</p>
          <p className="mt-1 font-mono text-xs text-muted">
            {lastSession.dayName} · {formatDate(lastSession.completedAt ?? lastSession.startedAt)}
            {lastSession.durationSec !== null && ` · ${formatDuration(lastSession.durationSec)}`}
            {lastSessionPRs > 0 && ` · ${lastSessionPRs} PR${lastSessionPRs > 1 ? "s" : ""}`}
          </p>
          <p className="mt-1 text-xs text-primary">Ver en Historial →</p>
        </button>
      )}
    </div>
  );
}
