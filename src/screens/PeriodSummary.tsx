import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { getCurrentWeekDays } from "../lib/schedule";
import { getExerciseProgression, DAY_ORDER } from "../lib/history";
import { getAttentionFlags } from "../lib/insights";
import { getPersonalRecordEvents } from "../lib/records";
import { formatDate, formatDuration } from "../lib/time";
import {
  getPeriodData,
  getExerciseRows,
  getPerformanceVariation,
  getSetsByDayType,
  getSetsByMuscleGroup,
  getLifestylePeriod,
  getMarginToPush,
  getPreviousPeriod,
  getFirstPeriod,
  getWeeksInPeriod,
  getTotalWeeks,
  getTotalMonths,
  getCurrentPeriodIndex,
  getPeriodLabel,
  type PeriodKind,
  type PeriodRef,
  type ExerciseRow,
} from "../lib/periodSummary";
import { ProgressChart } from "../components/ProgressChart";
import { VariationPill, ComparisonPill } from "../components/VariationPill";
import { PRDetailView } from "../components/PRDetailView";
import { IconChevronLeft, IconChevronRight, IconTrophy, IconFlame } from "../components/icons";

interface Props {
  onBack: () => void;
}

const STATUS_LABEL: Record<ExerciseRow["status"], string> = {
  progress: "Progresa",
  stable: "Estable",
  decline: "Baja",
  "new-variant": "Variante nueva",
};

const STATUS_BORDER: Record<ExerciseRow["status"], string> = {
  progress: "border-l-success",
  stable: "border-l-border",
  decline: "border-l-warning",
  "new-variant": "border-l-border",
};

function noPreviousMessage(period: PeriodRef): string {
  if (period.kind === "month") {
    const endOfThisMonth = period.index * 4;
    return `El mes anterior aparece al completar la semana ${endOfThisMonth + 1}.`;
  }
  return "La semana anterior aparece al completar esta semana.";
}

function ExerciseRowDetail({ row, dayName: _dayName }: { row: ExerciseRow; dayName: string }) {
  const { logs } = useApp();
  const points = useMemo(
    () => getExerciseProgression(logs, row.exercise, 0, row.dayName),
    [logs, row.exercise, row.dayName]
  );
  return (
    <div className="mt-2 rounded-block border border-border bg-surface2 p-3">
      <p className="mb-2 text-xs text-muted">
        Promedio del período: <span className="font-mono text-ink">{row.avgE1rm ? Math.round(row.avgE1rm) : "—"}kg e1RM</span>{" "}
        · {row.setsCount} serie{row.setsCount !== 1 ? "s" : ""}
      </p>
      <ProgressChart points={points} />
    </div>
  );
}

export function PeriodSummaryScreen({ onBack }: Props) {
  const { logs, program, flatDays, settings } = useApp();
  const cycle = settings.programCycle;

  const weekDays = useMemo(() => getCurrentWeekDays(flatDays, logs, cycle), [flatDays, logs, cycle]);
  const totalWeeks = getTotalWeeks(program);
  const totalMonths = getTotalMonths(program);
  const currentWeekNumber = weekDays[0]?.flatDay.weekNumber ?? totalWeeks;

  const [kind, setKind] = useState<PeriodKind>("week");
  const [index, setIndex] = useState(() => getCurrentPeriodIndex("week", currentWeekNumber));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"muscle" | "day">("muscle");
  const [showAllPRs, setShowAllPRs] = useState(false);

  function changeKind(next: PeriodKind) {
    setKind(next);
    setIndex(getCurrentPeriodIndex(next, currentWeekNumber));
    setExpanded(null);
  }

  const currentIndex = getCurrentPeriodIndex(kind, currentWeekNumber);
  const totalPeriods = kind === "week" ? totalWeeks : totalMonths;
  const period: PeriodRef = { kind, index };

  const data = useMemo(() => getPeriodData(logs, program, cycle, period), [logs, program, cycle, period]);
  const rows = useMemo(() => getExerciseRows(logs, program, cycle, period), [logs, program, cycle, period]);
  const perf = useMemo(() => getPerformanceVariation(rows), [rows]);
  const daySets = useMemo(() => getSetsByDayType(logs, program, cycle, period), [logs, program, cycle, period]);
  const muscleSets = useMemo(() => getSetsByMuscleGroup(logs, program, cycle, period), [logs, program, cycle, period]);
  const previousPeriod = useMemo(() => getPreviousPeriod(program, period), [program, period]);
  const isFirstPeriod = period.index === 1;

  const lifestyle = useMemo(
    () =>
      getLifestylePeriod(
        logs,
        cycle,
        data.weekNumbers,
        previousPeriod ? getWeeksInPeriod(program, previousPeriod) : []
      ),
    [logs, cycle, data.weekNumbers, previousPeriod, program]
  );

  const attention = useMemo(() => getAttentionFlags(logs, cycle, program), [logs, cycle, program]);
  const marginToPush = useMemo(
    () => getMarginToPush(logs, program, flatDays, settings, cycle, period),
    [logs, program, flatDays, settings, cycle, period]
  );
  const periodPRs = useMemo(
    () =>
      getPersonalRecordEvents(logs).filter(
        (e) => e.kind === "weight" && e.cycle === cycle && data.weekNumbers.includes(e.weekNumber)
      ),
    [logs, cycle, data.weekNumbers]
  );
  const bestImprovement = useMemo(() => {
    const progressing = rows.filter((r) => r.status === "progress" && r.vsPrevious.variationPct !== null);
    return progressing.sort((a, b) => (b.vsPrevious.variationPct ?? 0) - (a.vsPrevious.variationPct ?? 0))[0] ?? null;
  }, [rows]);

  const rowsByDay = DAY_ORDER.map((day) => ({ day, rows: rows.filter((r) => r.dayName === day) })).filter(
    (g) => g.rows.length > 0
  );

  const fairnessIncomplete = data.sessionsCompleted < data.sessionsPlanned;

  if (showAllPRs) {
    return (
      <PRDetailView currentWeekNumber={currentWeekNumber} cycle={cycle} onBack={() => setShowAllPRs(false)} />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-pill border border-border bg-surface2 text-ink transition-transform hover:bg-border/60 active:scale-95"
      >
        <IconChevronLeft className="h-[18px] w-[18px]" />
      </button>

      <div className="flex gap-2">
        {(["week", "month"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => changeKind(k)}
            className={`rounded-pill px-3 py-1.5 text-sm font-medium ${
              kind === k ? "bg-primary text-white" : "bg-surface2 text-faint"
            }`}
          >
            {k === "week" ? "Semana" : "Mes"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(1, i - 1))}
          disabled={index <= 1}
          aria-label="Período anterior"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-pill border border-border bg-surface2 text-ink disabled:opacity-30"
        >
          <IconChevronLeft className="h-[16px] w-[16px]" />
        </button>
        <h2 className="text-lg font-bold text-ink">{getPeriodLabel(period)}</h2>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(totalPeriods, i + 1))}
          disabled={index >= currentIndex}
          aria-label="Período siguiente"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-pill border border-border bg-surface2 text-ink disabled:opacity-30"
        >
          <IconChevronRight className="h-[16px] w-[16px]" />
        </button>
      </div>

      <div className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            {data.weekNumbers.length > 1 ? `Semanas ${data.weekNumbers[0]}-${data.weekNumbers[data.weekNumbers.length - 1]}` : `Semana ${data.weekNumbers[0] ?? "—"}`}
          </p>
          {data.isDeload && (
            <span className="rounded-pill bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">deload</span>
          )}
        </div>
        <p className="mt-1 font-mono text-2xl font-bold text-ink">
          {data.sessionsCompleted} / {data.sessionsPlanned} <span className="text-sm font-normal text-muted">sesiones</span>
        </p>
        {fairnessIncomplete && (
          <p className="mt-1 text-xs text-muted">
            Período incompleto · {data.sessionsCompleted} de {data.sessionsPlanned} sesiones hechas hasta ahora.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-border bg-surface p-3 shadow-elevated-sm">
          <p className="font-mono text-xl font-bold text-ink">{Math.round(data.tonnageKg).toLocaleString("es-AR")}kg</p>
          <p className="text-xs text-faint">tonelaje</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-3 shadow-elevated-sm">
          <p className="font-mono text-xl font-bold text-ink">{data.totalSets}</p>
          <p className="text-xs text-faint">series totales</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-3 shadow-elevated-sm">
          <p className="font-mono text-xl font-bold text-ink">{data.avgRir !== null ? data.avgRir.toFixed(1) : "—"}</p>
          <p className="text-xs text-faint">RIR promedio</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-3 shadow-elevated-sm">
          <p className="font-mono text-xl font-bold text-ink">
            {data.avgSessionDurationSec !== null ? formatDuration(Math.round(data.avgSessionDurationSec)) : "—"}
          </p>
          <p className="text-xs text-faint">duración promedio</p>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <p className="mb-2 text-sm font-medium text-ink">Rendimiento (e1RM promedio)</p>
        {isFirstPeriod || !previousPeriod ? (
          <p className="text-sm text-muted">{noPreviousMessage(period)}</p>
        ) : (
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-faint">vs. {getPeriodLabel(previousPeriod)}</p>
              <VariationPill pct={perf.vsPrevious} />
            </div>
            {!isFirstPeriod && (
              <div>
                <p className="text-xs text-faint">vs. {getPeriodLabel(getFirstPeriod(kind))}</p>
                <VariationPill pct={perf.vsFirst} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Por ejercicio</p>
        {rowsByDay.length === 0 && <p className="text-sm text-muted">Sin registros en este período todavía.</p>}
        {rowsByDay.map(({ day, rows: dayRows }) => (
          <div key={day} className="space-y-1.5">
            <p className="text-xs font-medium text-faint">{day}</p>
            {dayRows.map((row) => {
              const rowKey = `${row.dayName}::${row.exercise}`;
              return (
                <div key={rowKey} className={`rounded-block border border-l-[3px] border-border bg-surface p-3 ${STATUS_BORDER[row.status]}`}>
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => (e === rowKey ? null : rowKey))}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="font-medium text-ink">{row.exercise}</p>
                      <p className="text-xs text-faint">
                        {row.avgE1rm !== null ? `${Math.round(row.avgE1rm)}kg e1RM` : "sin datos"} · {STATUS_LABEL[row.status]}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <ComparisonPill cell={row.vsPrevious} />
                      {!isFirstPeriod && <ComparisonPill cell={row.vsFirst} />}
                    </div>
                  </button>
                  {expanded === rowKey && <ExerciseRowDetail row={row} dayName={row.dayName} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {(muscleSets.length > 0 || daySets.length > 0) && (
        <div className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Series {groupBy === "muscle" ? "por músculo" : "por tipo de día"}</p>
            <div className="flex gap-1.5">
              {(["muscle", "day"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  className={`rounded-pill px-2.5 py-1 text-xs font-semibold transition-colors ${
                    groupBy === g ? "bg-primary text-white" : "bg-surface2 text-faint"
                  }`}
                >
                  {g === "muscle" ? "Por músculo" : "Por tipo de día"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            {groupBy === "muscle"
              ? muscleSets.map((m) => (
                  <div key={m.muscle} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{m.muscle}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-ink">{m.sets}</span>
                      <VariationPill pct={m.vsPreviousPct} neutral />
                    </span>
                  </div>
                ))
              : daySets.map((d) => (
                  <div key={d.dayName} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{d.dayName}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-ink">{d.sets}</span>
                      <VariationPill pct={d.vsPreviousPct} neutral />
                    </span>
                  </div>
                ))}
          </div>
        </div>
      )}

      {lifestyle.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
          <p className="mb-2 text-sm font-medium text-ink">Lifestyle del período</p>
          <div className="space-y-1.5">
            {lifestyle.map((l) => (
              <div key={l.key} className="flex items-center justify-between text-sm">
                <span className="text-muted">{l.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-ink">{l.format(l.avg as number)}</span>
                  <VariationPill pct={l.vsPreviousPct} neutral />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Destacados</p>

        {bestImprovement && (
          <div className="flex items-start gap-2 rounded-block border border-success/30 bg-success/5 p-3">
            <IconFlame className="h-8 w-8 shrink-0 text-success" />
            <div>
              <p className="text-xs font-medium text-success">Mejor mejora del período</p>
              <p className="text-sm text-ink">{bestImprovement.exercise}</p>
              <VariationPill pct={bestImprovement.vsPrevious.variationPct} />
            </div>
          </div>
        )}

        {attention.slice(0, 2).map((a, i) => (
          <div key={i} className="flex items-start gap-2 rounded-block border border-warning/30 bg-warning/5 p-3">
            <IconFlame className="h-8 w-8 shrink-0 text-warning" />
            <div>
              <p className="text-xs font-medium text-warning">Ejercicio a vigilar</p>
              <p className="text-sm text-ink">{a.exercise}</p>
              <p className="text-xs text-muted">{a.detail}</p>
            </div>
          </div>
        ))}

        {periodPRs.length > 0 && (
          <div className="rounded-block border border-accent/30 bg-accent/5 p-3">
            <div className="flex items-start gap-2">
              <IconTrophy className="h-8 w-8 shrink-0 text-accent" />
              <div>
                <p className="text-xs font-medium text-accent">PRs logrados</p>
                <p className="text-sm text-ink">
                  {periodPRs.length} récord{periodPRs.length > 1 ? "s" : ""} de peso
                </p>
              </div>
            </div>
            <ul className="mt-2 space-y-1 pl-10 font-mono text-xs text-muted">
              {periodPRs.map((e, i) => (
                <li key={i}>
                  {e.exercise}: {e.weightKg}kg × {e.reps} · {formatDate(e.date)}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowAllPRs(true)}
              className="mt-2 pl-10 text-xs font-medium text-accent"
            >
              Ver todos los PRs →
            </button>
          </div>
        )}

        {marginToPush.length > 0 && (
          <div className="rounded-block border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-medium text-primary">Margen para subir</p>
            <ul className="mt-1 space-y-1.5">
              {marginToPush.map((m, i) => (
                <li key={i} className="text-sm text-ink">
                  <span className="font-medium">{m.exercise}</span>{" "}
                  <span className="text-xs text-faint">({m.dayName})</span>
                  <p className="font-mono text-xs text-muted">
                    Pediste RIR {m.targetRir} y llegaste con RIR {m.actualRir}: probá subir{" "}
                    {(m.suggestedWeightKg - m.weightKg).toFixed(1)}kg (a {m.suggestedWeightKg}kg)
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
