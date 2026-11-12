import { useApp } from "../context/AppContext";
import { MiniTrendChart } from "../components/MiniTrendChart";
import { Pill } from "../components/habits/Pill";
import { ExactValueField } from "../components/habits/ExactValueField";
import { SecondaryValueField } from "../components/habits/SecondaryValueField";
import { habitIconFor, HABIT_COLORS } from "../components/habits/habitVisuals";
import { localDateKey } from "../lib/time";
import { addLog, latestLoggedValue } from "../lib/habitLogs";
import { buildHabitTrendSeries, changeVsPreviousWeek } from "../lib/habitTrend";
import type { Habit } from "../types/habits";

function formatValue(v: number, unit: string): string {
  return `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ""}`;
}

function MetricCard({ habit, onOpenDetail }: { habit: Habit; onOpenDetail: (habitId: string) => void }) {
  const { logs, upsertHabitLog, upsertHabitEntry, removeHabitEntry } = useApp();
  const today = localDateKey(new Date());
  const color = HABIT_COLORS[habit.color];
  const Icon = habitIconFor(habit.icon);

  const latest = latestLoggedValue(habit, logs.habitLogs, today);
  const trendPoints = buildHabitTrendSeries(habit, logs.habitLogs, today, 7).filter(
    (p): p is { date: string; value: number } => p.value !== null
  );
  const change = changeVsPreviousWeek(habit, logs.habitLogs, today);
  const goalPct = habit.goal && latest ? Math.min(100, Math.round((latest.value / habit.goal) * 100)) : null;

  function handleAdd(value: number | null, secondaryValue: number | null = null) {
    const result = addLog(habit, logs.habitLogs, logs.habitEntries, today, value, "manual", secondaryValue);
    upsertHabitLog(result.log);
    if (result.entry) upsertHabitEntry(result.entry);
    else if (result.previousEntry) removeHabitEntry(result.previousEntry.id);
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onOpenDetail(habit.id)} className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-block text-habitink" style={{ backgroundColor: color }}>
            <Icon className="h-4 w-4" />
          </span>
          {habit.name}
        </button>
        {change && (
          <Pill tone="neu">
            {change.deltaPct >= 0 ? "+" : ""}
            {change.deltaPct.toFixed(1)}% vs. sem. anterior
          </Pill>
        )}
      </div>

      {latest ? (
        <>
          <p className="mt-2 font-mono text-[28px] font-extrabold leading-none text-ink">
            {latest.value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
            <small className="ml-1 text-sm font-semibold text-muted">{habit.unit ?? ""}</small>
            {!latest.isToday && <small className="ml-1.5 text-[11px] font-normal text-faint">(último: {latest.date.slice(8, 10)}/{latest.date.slice(5, 7)})</small>}
          </p>
          {goalPct !== null && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-pill bg-surface2">
                <div className="h-full rounded-pill transition-all duration-500" style={{ width: `${goalPct}%`, backgroundColor: color }} />
              </div>
              <p className="mt-1 text-[11px] text-faint">{goalPct}% de la meta ({formatValue(habit.goal as number, habit.unit ?? "")})</p>
            </div>
          )}
          {trendPoints.length >= 2 && (
            <div className="mt-2.5">
              <MiniTrendChart points={trendPoints} colorClassName="text-muted" />
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-faint">Todavía no hay registros. Cargá el primero acá abajo.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
        {habit.quickSteps.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleAdd(n)}
            className="h-8 rounded-pill border px-2.5 font-mono text-[12px] font-bold text-ink"
            style={{
              backgroundColor: `color-mix(in srgb, ${color} 20%, rgb(var(--surface)))`,
              borderColor: `color-mix(in srgb, ${color} 50%, rgb(var(--border)))`,
            }}
          >
            {habit.aggregation === "sum" ? "+" : ""}
            {n} {habit.unit ?? ""}
          </button>
        ))}
        <ExactValueField unit={habit.unit ?? ""} color={color} onAdd={handleAdd} />
      </div>
      {habit.secondaryField && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {habit.secondaryField.quickValues.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleAdd(null, n)}
              className="h-8 rounded-pill border px-2.5 font-mono text-[12px] font-bold text-ink"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 20%, rgb(var(--surface)))`,
                borderColor: `color-mix(in srgb, ${color} 50%, rgb(var(--border)))`,
              }}
            >
              {n}
            </button>
          ))}
          <SecondaryValueField field={habit.secondaryField} color={color} onAdd={(v) => handleAdd(null, v)} />
        </div>
      )}
    </div>
  );
}

interface Props {
  onOpenDetail: (habitId: string) => void;
}

/** Hábitos nativos de "Métricas" (Peso/Sueño/Pasos/Agua, HABI7 v2 Fase 6): fuente única de estas 4 señales, sin pasar por Lifestyle. */
export function HabitsMetricsScreen({ onOpenDetail }: Props) {
  const { logs } = useApp();
  const metricHabits = logs.habits.filter((h) => h.metricKind !== null && !h.archivedAt);

  if (metricHabits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 pt-10 text-center">
        <p className="text-sm font-medium text-ink">No hay métricas activas</p>
        <p className="max-w-xs text-xs text-muted">Archivaste los 4 hábitos de Peso/Sueño/Pasos/Agua. Restauralos desde Hábitos archivados para volver a verlos acá.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {metricHabits.map((habit) => (
        <MetricCard key={habit.id} habit={habit} onOpenDetail={onOpenDetail} />
      ))}
    </div>
  );
}
