import { useState } from "react";
import { useApp } from "../context/AppContext";
import { localDateKey } from "../lib/time";
import { computeHabitStreak, consistencyScore, compliancePct } from "../lib/habitStreaks";
import {
  buildHabitHeatCells,
  buildMonthCalendar,
  monthLabelsForHeat,
  monthlyCompliancePctSeries,
  weeklyDoneSeries,
} from "../lib/habitProgress";
import { archiveHabit, setEntryStatus } from "../lib/habitActions";
import { addLog, editLog, logsForDate, removeLog } from "../lib/habitLogs";
import { averageOf, buildHabitTrendSeries, changeVsPreviousWeek, movingAverage7, type TrendRange } from "../lib/habitTrend";
import { habitIconFor, HABIT_COLORS } from "../components/habits/habitVisuals";
import { colorForPct } from "../lib/heatScale";
import { Ring } from "../components/habits/Ring";
import { HeatGrid } from "../components/habits/HeatGrid";
import { BarChart } from "../components/habits/BarChart";
import { LogTrendChart } from "../components/habits/LogTrendChart";
import { TodayLogsList } from "../components/habits/TodayLogsList";
import { ExactValueField } from "../components/habits/ExactValueField";
import { SegmentedControl } from "../components/habits/SegmentedControl";
import { IconButton } from "../components/habits/IconButton";
import { IconArchive, IconArrowDown, IconArrowLeft, IconArrowUp, IconChevronLeft, IconChevronRight, IconFlame, IconPencil } from "../components/icons";
import type { Habit } from "../types/habits";

const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

interface Props {
  habit: Habit;
  onBack: () => void;
  onEdit: () => void;
}

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export function HabitDetailScreen({ habit, onBack, onEdit }: Props) {
  const { logs, upsertHabitEntry, removeHabitEntry, upsertHabit, upsertHabitLog, removeHabitLog } = useApp();
  const today = localDateKey(new Date());
  const [evoMode, setEvoMode] = useState<"sem" | "mes">("sem");
  const [range, setRange] = useState<TrendRange>(7);
  const [cal, setCal] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const color = HABIT_COLORS[habit.color];
  const Icon = habitIconFor(habit.icon);
  const entries = logs.habitEntries;

  const isTracking = habit.type === "tracking";
  const isLoggable = habit.type === "quantity" || isTracking;

  const { streak, best } = computeHabitStreak(habit, entries, today);
  const consistency = consistencyScore(habit, entries, today);
  const c7 = compliancePct(habit, entries, 7, today);
  const c30 = compliancePct(habit, entries, 30, today);
  const c90 = compliancePct(habit, entries, 90, today);

  const heatCells = buildHabitHeatCells(habit, entries, today, 16);
  const monthLabels = monthLabelsForHeat(today, 16);

  const weekBars = weeklyDoneSeries(habit, entries, today, 8);
  const monthBars = monthlyCompliancePctSeries(habit, entries, today, 6);

  const monthName = `${MESES_LARGO[cal.month - 1]} ${cal.year}`;
  const calendarCells = buildMonthCalendar(habit, entries, cal.year, cal.month, today);

  const todayLogs = isLoggable ? logsForDate(habit, logs.habitLogs, today) : [];
  const trendPoints = isLoggable ? buildHabitTrendSeries(habit, logs.habitLogs, today, range) : [];
  const trendAvg = isLoggable ? averageOf(trendPoints) : null;
  const isWeightLike = isLoggable && habit.unit === "kg" && habit.aggregation === "last";
  const movingAvg = isWeightLike ? movingAverage7(trendPoints) : undefined;
  const weekChange = isWeightLike ? changeVsPreviousWeek(habit, logs.habitLogs, today) : null;

  function handleAddLog(value: number) {
    const result = addLog(habit, logs.habitLogs, entries, today, value);
    upsertHabitLog(result.log);
    if (result.entry) upsertHabitEntry(result.entry);
    else if (result.previousEntry) removeHabitEntry(result.previousEntry.id);
  }

  function handleEditLog(logId: string, value: number) {
    const result = editLog(habit, logs.habitLogs, entries, logId, value);
    if (!result) return;
    upsertHabitLog(result.log);
    if (result.entry) upsertHabitEntry(result.entry);
    else if (result.previousEntry) removeHabitEntry(result.previousEntry.id);
  }

  function handleRemoveLog(logId: string) {
    const result = removeLog(habit, logs.habitLogs, entries, logId);
    if (!result) return;
    removeHabitLog(logId);
    if (result.entry) upsertHabitEntry(result.entry);
    else if (result.previousEntry) removeHabitEntry(result.previousEntry.id);
  }

  function shiftMonth(delta: number) {
    setSelectedDate(null);
    setCal(({ year, month }) => {
      let m = month + delta;
      let y = year;
      if (m < 1) {
        m = 12;
        y -= 1;
      } else if (m > 12) {
        m = 1;
        y += 1;
      }
      return { year: y, month: m };
    });
  }

  function applyDayStatus(status: "done" | "skip" | "none") {
    if (!selectedDate) return;
    const result = setEntryStatus(habit, entries, selectedDate, status);
    if (result.next) upsertHabitEntry(result.next);
    else if (result.previous) removeHabitEntry(result.previous.id);
  }

  function archive() {
    if (window.confirm(`¿Archivar "${habit.name}"? Se conserva todo su historial.`)) {
      upsertHabit(archiveHabit(habit));
      onBack();
    }
  }

  const selectedCell = selectedDate ? calendarCells.find((c) => c?.date === selectedDate) ?? null : null;
  const selectedStatusValue = selectedCell && selectedCell.status !== "future" ? selectedCell.status : "none";

  return (
    <div className="-mx-4 -mt-6 pb-24 md:mx-0 md:mt-0">
      <div className="rounded-b-[30px] px-4 pb-5 pt-6 text-habitink md:rounded-card md:pt-5" style={{ backgroundColor: color }}>
        <div className="flex justify-between">
          <IconButton aria-label="Volver" variant="onColor" onClick={onBack}>
            <IconArrowLeft className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton aria-label="Editar" variant="onColor" onClick={onEdit}>
            <IconPencil className="h-[17px] w-[17px]" />
          </IconButton>
        </div>
        <div className="mt-4 flex items-center gap-3.5">
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-block bg-habitink/[0.14]">
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{habit.name}</h1>
            <p className="mt-0.5 text-[13px] text-habitink/80">
              {habit.frequency.kind === "daily"
                ? "Todos los días"
                : habit.frequency.kind === "weekly"
                  ? `${habit.frequency.n} veces por semana`
                  : habit.frequency.kind === "every"
                    ? `Cada ${habit.frequency.n} días`
                    : "Días específicos"}
              {" · "}
              {habit.timeOfDay}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3.5 px-4 pt-4 md:px-0">
        {!isTracking && (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-block border border-border bg-surface p-3">
                <div className="flex items-center gap-1 font-mono text-xl font-extrabold text-ink">
                  <IconFlame className="h-4 w-4 text-warning" />
                  {streak}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">Racha actual</p>
              </div>
              <div className="rounded-block border border-border bg-surface p-3">
                <p className="font-mono text-xl font-extrabold text-ink">{best}</p>
                <p className="mt-0.5 text-[11px] text-muted">Mejor racha</p>
              </div>
              <div className="rounded-block border border-border bg-surface p-3">
                <p className="font-mono text-xl font-extrabold text-ink">{consistency}</p>
                <p className="mt-0.5 text-[11px] text-muted">Constancia</p>
              </div>
            </div>

            <div className="rounded-card border border-border bg-surface p-4">
              <div className="mb-3 flex justify-between text-xs">
                <span className="font-bold text-muted">Cumplimiento</span>
                <span className="text-faint">un día salteado no cuenta en contra</span>
              </div>
              <div className="flex justify-around">
                {[
                  ["7 días", c7],
                  ["30 días", c30],
                  ["90 días", c90],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex flex-col items-center gap-1.5 text-[11.5px] text-muted">
                    <Ring
                      size={70}
                      strokeWidth={7}
                      pct={(value as number | null) ?? 0}
                      color={color}
                      centerLabel={<span className="font-mono text-[15px] font-extrabold text-ink">{pct(value as number | null)}</span>}
                    />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-card border border-border bg-surface p-4">
              <div className="mb-2.5 flex justify-between text-xs font-bold text-muted">Últimas 16 semanas</div>
              <HeatGrid cells={heatCells} monthLabels={monthLabels} />
            </div>
          </>
        )}

        {isLoggable && (
          <>
            <div className="rounded-card border border-border bg-surface p-4">
              <b className="text-sm text-ink">Hoy</b>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {habit.quickSteps.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleAddLog(n)}
                    className="h-9 rounded-pill border px-3 font-mono text-[13px] font-bold text-ink"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${color} 20%, rgb(var(--surface)))`,
                      borderColor: `color-mix(in srgb, ${color} 50%, rgb(var(--border)))`,
                    }}
                  >
                    +{n} {habit.unit ?? ""}
                  </button>
                ))}
                <ExactValueField unit={habit.unit ?? ""} color={color} onAdd={handleAddLog} />
              </div>
              <div className="mt-3">
                <TodayLogsList logs={todayLogs} unit={habit.unit ?? ""} color={color} onEdit={handleEditLog} onRemove={handleRemoveLog} />
              </div>
            </div>

            <div className="rounded-card border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <b className="text-sm text-ink">Variación</b>
                <div className="w-[170px]">
                  <SegmentedControl<TrendRange>
                    options={[
                      { value: 7, label: "7d" },
                      { value: 30, label: "30d" },
                      { value: 90, label: "90d" },
                    ]}
                    value={range}
                    onChange={setRange}
                  />
                </div>
              </div>
              {isWeightLike && weekChange && (
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  {weekChange.deltaAbs >= 0 ? (
                    <IconArrowUp className="h-3.5 w-3.5 text-muted" />
                  ) : (
                    <IconArrowDown className="h-3.5 w-3.5 text-success" />
                  )}
                  <span className="text-muted">
                    {weekChange.deltaAbs >= 0 ? "+" : ""}
                    {weekChange.deltaAbs.toFixed(1)} kg ({weekChange.deltaPct >= 0 ? "+" : ""}
                    {weekChange.deltaPct.toFixed(1)}%) vs. semana anterior
                  </span>
                </div>
              )}
              <LogTrendChart
                points={trendPoints}
                mode={habit.aggregation === "sum" ? "bar" : "line"}
                unit={habit.unit ?? ""}
                color={color}
                goal={habit.goal}
                average={trendAvg}
                movingAverage={movingAvg}
                ariaLabel={`Variación de ${habit.name} en los últimos ${range} días`}
              />
            </div>
          </>
        )}

        {!isLoggable && (
          <div className="rounded-card border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <b className="text-sm text-ink">Evolución</b>
              <div className="w-[150px]">
                <SegmentedControl<"sem" | "mes">
                  options={[
                    { value: "sem", label: "Semanal" },
                    ...(habit.frequency.kind !== "weekly" ? [{ value: "mes" as const, label: "Mensual" }] : []),
                  ]}
                  value={evoMode}
                  onChange={setEvoMode}
                />
              </div>
            </div>
            {evoMode === "sem" ? (
              <BarChart bars={weekBars} ariaLabel="Días cumplidos por semana" />
            ) : (
              <BarChart bars={monthBars} valueSuffix="%" maxValue={100} ariaLabel="Cumplimiento por mes" />
            )}
          </div>
        )}

        {!isTracking && (
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <IconButton aria-label="Mes anterior" onClick={() => shiftMonth(-1)}>
              <IconChevronLeft className="h-4 w-4" />
            </IconButton>
            <b className="text-[15px] text-ink">{monthName}</b>
            <IconButton aria-label="Mes siguiente" onClick={() => shiftMonth(1)}>
              <IconChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {DOW_LETTERS.map((d) => (
              <div key={d} className="pb-0.5 text-center text-[11px] font-bold text-faint">
                {d}
              </div>
            ))}
            {calendarCells.map((c, i) =>
              c === null ? (
                <div key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={c.status === "future"}
                  onClick={() => setSelectedDate(c.date)}
                  className={`flex aspect-square items-center justify-center rounded-pill font-mono text-[12.5px] font-bold disabled:pointer-events-none ${
                    c.status === "future" ? "text-faint opacity-55" : c.status === "none" ? "text-faint" : ""
                  } ${c.date === today ? "shadow-[0_0_0_2px_rgb(var(--text))]" : ""} ${
                    c.date === selectedDate ? "shadow-[0_0_0_2px_rgb(var(--primary))]" : ""
                  }`}
                  style={
                    c.heat.pct !== null
                      ? { backgroundColor: colorForPct(c.heat.pct), color: "#0d0e13" }
                      : c.status === "skip"
                        ? { backgroundColor: "rgb(var(--ghost))", color: "rgb(var(--muted))" }
                        : undefined
                  }
                >
                  {c.day}
                </button>
              )
            )}
          </div>
          {selectedDate && (
            <div className="mt-3.5 rounded-block bg-surface2 p-3">
              <p className="mb-2 text-xs text-muted">
                {selectedCell?.heat.label ?? selectedDate} · tocá una opción para cambiarlo
              </p>
              <SegmentedControl<"done" | "skip" | "none">
                options={[
                  { value: "done", label: "Hecho" },
                  { value: "skip", label: "Salteado" },
                  { value: "none", label: "Sin registro" },
                ]}
                value={selectedStatusValue}
                onChange={(v) => applyDayStatus(v as "done" | "skip" | "none")}
              />
            </div>
          )}
        </div>
        )}

        {habit.why && (
          <div className="rounded-card border border-border bg-surface p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted">Por qué lo hago</div>
            <p className="text-sm leading-relaxed text-ink">&ldquo;{habit.why}&rdquo;</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center justify-center gap-2 rounded-pill border border-border bg-surface py-2.5 text-sm font-semibold text-ink"
          >
            <IconPencil className="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            onClick={archive}
            className="flex items-center justify-center gap-2 rounded-pill border border-border bg-surface py-2.5 text-sm font-semibold text-ink"
          >
            <IconArchive className="h-4 w-4" />
            Archivar
          </button>
        </div>
      </div>
    </div>
  );
}
