import { useApp } from "../context/AppContext";
import { localDateKey } from "../lib/time";
import { addDays } from "../lib/habitStreaks";
import { bestWeekdays, buildGlobalHeatCells, buildWeekSummary, monthLabelsForHeat, overallConsistency, rankHabitsByConsistency } from "../lib/habitProgress";
import { HeatGrid } from "../components/habits/HeatGrid";
import { Pill } from "../components/habits/Pill";
import { habitIconFor, HABIT_COLORS } from "../components/habits/habitVisuals";
import { IconArrowUp, IconArrowDown } from "../components/icons";

interface Props {
  onOpenDetail: (habitId: string) => void;
}

export function HabitsProgressScreen({ onOpenDetail }: Props) {
  const { logs } = useApp();
  const today = localDateKey(new Date());
  const { habits, habitEntries: entries } = logs;

  if (habits.filter((h) => !h.archivedAt).length === 0) {
    return <p className="pt-10 text-center text-sm text-faint">Creá tu primer hábito para ver tu progreso acá.</p>;
  }

  const consistencyNow = overallConsistency(habits, entries, today);
  const consistency30ago = overallConsistency(habits, entries, addDays(today, -30));
  const vsLastMonth = consistencyNow !== null && consistency30ago !== null ? consistencyNow - consistency30ago : null;

  const ranked = rankHabitsByConsistency(habits, entries, today);
  const best = ranked.slice(0, 2);
  const worst = [...ranked].reverse().slice(0, 2);

  const weekdayStats = bestWeekdays(habits, entries, today, 90);
  const maxPct = Math.max(...weekdayStats.map((d) => d.pct), 1);
  const bestWeekdayLetter = weekdayStats.reduce((a, b) => (b.pct > a.pct ? b : a)).letter;

  const heatCells = buildGlobalHeatCells(habits, entries, today, 16);
  const monthLabels = monthLabelsForHeat(today, 16);

  const summary = buildWeekSummary(habits, entries, today);

  function rankRow(r: (typeof ranked)[number]) {
    const Icon = habitIconFor(r.habit.icon);
    return (
      <button
        key={r.habit.id}
        type="button"
        onClick={() => onOpenDetail(r.habit.id)}
        className="flex w-full items-center gap-2.5 text-left"
      >
        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-block text-habitink"
          style={{ backgroundColor: HABIT_COLORS[r.habit.color] }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">{r.habit.name}</span>
        {/* text-ink siempre (no text-warning para "warn"): directo sobre la superficie no llegaba a 4.5:1 en
            tema claro (2.76:1); el agrupamiento en "Para darles una mano" ya distingue sin depender del color. */}
        <span className="font-mono text-sm font-extrabold text-ink">{r.score}%</span>
      </button>
    );
  }

  return (
    <div className="space-y-3.5 pb-24">
      <div className="rounded-card border border-border bg-surface p-4 shadow-elevated-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="font-bold text-muted">Constancia general</span>
            </div>
            <p className="font-mono text-4xl font-extrabold leading-none text-ink">
              {consistencyNow ?? "—"}
              <small className="text-xl">%</small>
            </p>
            <p className="mt-1 text-[11px] text-faint">últimos 30 días</p>
          </div>
          {vsLastMonth !== null && (
            <Pill
              tone={vsLastMonth >= 0 ? "ok" : "warn"}
              icon={vsLastMonth >= 0 ? <IconArrowUp className="h-3 w-3" strokeWidth={2.6} /> : <IconArrowDown className="h-3 w-3" strokeWidth={2.6} />}
            >
              {vsLastMonth >= 0 ? "+" : ""}
              {vsLastMonth}% vs. mes anterior
            </Pill>
          )}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-pill bg-surface2">
          <div className="h-full rounded-pill bg-success transition-[width]" style={{ width: `${consistencyNow ?? 0}%` }} />
        </div>
        <p className="mt-2.5 text-xs text-muted">
          {consistencyNow !== null && consistencyNow >= 70
            ? "Vas muy bien. Lo importante es seguir apareciendo."
            : "Cada toque suma. Arrancá con lo más fácil."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-card border border-border bg-surface p-3.5">
          <p className="mb-2.5 text-xs font-bold text-muted">En su mejor momento</p>
          <div className="flex flex-col gap-2.5">{best.map((r) => rankRow(r))}</div>
        </div>
        <div className="rounded-card border border-border bg-surface p-3.5">
          <p className="mb-2.5 text-xs font-bold text-muted">Para darles una mano</p>
          <div className="flex flex-col gap-2.5">{worst.map((r) => rankRow(r))}</div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-bold text-muted">Mejores días de la semana</span>
          <span className="text-faint">tu mejor: {bestWeekdayLetter}</span>
        </div>
        <div className="mt-2 flex h-[120px] items-end justify-between gap-2">
          {weekdayStats.map((d) => (
            <div key={d.letter} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5 text-[11px] text-muted">
              <b className="font-mono text-[10.5px] text-ink">{d.pct}</b>
              <i
                className={`block w-full rounded-t-[6px] rounded-b-[3px] ${
                  d.pct === maxPct ? "bg-success" : d.pct >= maxPct * 0.84 ? "bg-primary/70" : "bg-surface2"
                }`}
                style={{ height: `${Math.max(4, (d.pct / maxPct) * 78)}px` }}
              />
              {d.letter}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <div className="mb-2.5 flex justify-between text-xs">
          <span className="font-bold text-muted">Mapa de calor global</span>
          <span className="text-faint">16 semanas</span>
        </div>
        <HeatGrid cells={heatCells} monthLabels={monthLabels} />
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <p className="mb-3 text-xs font-bold text-muted">Resumen de la semana</p>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-block border border-border p-3">
            <p className="font-mono text-xl font-extrabold text-ink">
              {summary.daysComplete}
              <small className="text-xs text-muted">/{summary.daysElapsed}</small>
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Días completos</p>
          </div>
          <div className="rounded-block border border-border p-3">
            <p className="font-mono text-xl font-extrabold text-ink">
              {summary.habitsDone}
              <small className="text-xs text-muted">/{summary.habitsTotal}</small>
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Hábitos hechos</p>
          </div>
          <div className="rounded-block border border-border p-3">
            <p className="font-mono text-xl font-extrabold text-ink">
              {summary.compliancePct !== null ? Math.round(summary.compliancePct) : "—"}
              <small className="text-xs text-muted">%</small>
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Cumplimiento</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.vsLastWeekPct !== null && (
            <Pill
              tone={summary.vsLastWeekPct >= 0 ? "ok" : "warn"}
              icon={summary.vsLastWeekPct >= 0 ? <IconArrowUp className="h-3 w-3" strokeWidth={2.6} /> : <IconArrowDown className="h-3 w-3" strokeWidth={2.6} />}
            >
              {summary.vsLastWeekPct >= 0 ? "+" : ""}
              {summary.vsLastWeekPct}% vs. semana pasada
            </Pill>
          )}
          {summary.bestDayLetter && <Pill tone="neu">Mejor día: {summary.bestDayLetter}</Pill>}
        </div>
      </div>
    </div>
  );
}
