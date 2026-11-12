import { useState } from "react";
import type { Habit, HabitLog } from "../../types/habits";
import { addLog, latestLoggedValue } from "../../lib/habitLogs";
import { habitIconFor, HABIT_COLORS } from "./habitVisuals";
import { QuickMetricSheet } from "./QuickMetricSheet";
import { useApp } from "../../context/AppContext";
import { localDateKey } from "../../lib/time";

interface Props {
  /** Hábitos nativos "tracking" de Métricas (Peso/Sueño/Pasos) — Agua queda en la lista normal, es de cantidad. */
  habits: Habit[];
  habitLogs: HabitLog[];
  onOpenDetail: (habitId: string) => void;
}

function formatCompact(habit: Habit, value: number): string {
  if (habit.metricKind === "steps") return Math.round(value).toLocaleString("es-AR");
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${habit.unit ? ` ${habit.unit}` : ""}`;
}

/**
 * Tira horizontal angosta de carga rápida para Peso/Sueño/Pasos desde "Hoy"
 * (HABI7 v2 Fase 6A). No suma al anillo ni a la racha — son hábitos
 * "tracking", sin cumplimiento; esto es solo un atajo de carga.
 */
export function HabitsTodayMetricsStrip({ habits, habitLogs, onOpenDetail }: Props) {
  const { logs, upsertHabitLog, upsertHabitEntry, removeHabitEntry } = useApp();
  const [openHabitId, setOpenHabitId] = useState<string | null>(null);
  const today = localDateKey(new Date());

  if (habits.length === 0) return null;
  const openHabit = habits.find((h) => h.id === openHabitId) ?? null;

  function handleAdd(habit: Habit, value: number | null, secondaryValue: number | null = null) {
    const result = addLog(habit, logs.habitLogs, logs.habitEntries, today, value, "manual", secondaryValue);
    upsertHabitLog(result.log);
    if (result.entry) upsertHabitEntry(result.entry);
    else if (result.previousEntry) removeHabitEntry(result.previousEntry.id);
  }

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {habits.map((habit) => {
          const Icon = habitIconFor(habit.icon);
          const color = HABIT_COLORS[habit.color];
          const todayValue = latestLoggedValue(habit, habitLogs, today);
          const hasToday = todayValue?.isToday ?? false;
          return (
            <div key={habit.id} className="flex w-[108px] shrink-0 flex-col gap-1.5 rounded-block border border-border bg-surface p-2.5">
              <button
                type="button"
                onClick={() => onOpenDetail(habit.id)}
                className="flex items-center gap-1.5 text-left text-[11.5px] font-bold text-ink"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                <span className="truncate">{habit.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setOpenHabitId(habit.id)}
                className="rounded-pill bg-surface2 py-1.5 text-center font-mono text-[13px] font-extrabold text-ink"
              >
                {hasToday ? formatCompact(habit, todayValue!.value) : <span className="font-sans text-[11px] font-semibold text-primary">Cargar</span>}
              </button>
            </div>
          );
        })}
      </div>

      {openHabit && (
        <QuickMetricSheet
          habit={openHabit}
          color={HABIT_COLORS[openHabit.color]}
          lastValue={latestLoggedValue(openHabit, habitLogs, today)?.value ?? null}
          onAdd={(value, secondaryValue) => handleAdd(openHabit, value, secondaryValue)}
          onOpenDetail={() => {
            setOpenHabitId(null);
            onOpenDetail(openHabit.id);
          }}
          onClose={() => setOpenHabitId(null)}
        />
      )}
    </>
  );
}
