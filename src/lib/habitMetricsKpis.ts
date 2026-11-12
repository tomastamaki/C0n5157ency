import type { Habit, HabitLog, HabitMetricKind } from "../types/habits";
import { aggregateForDate } from "./habitLogs";

/** Días con datos que hacen falta dentro de los últimos 7 para mostrar una comparación confiable. */
const MIN_DAYS_FOR_VARIATION = 3;

/** Pesos por recencia para el promedio ponderado de 7 días (hoy pesa 7, hace 6 días pesa 1) — mismo criterio que el algoritmo de recuperación. */
const RECENCY_WEIGHTS_7D = [7, 6, 5, 4, 3, 2, 1];

function daysBetween(dateKey: string, refKey: string): number {
  return (new Date(refKey).getTime() - new Date(dateKey).getTime()) / (24 * 60 * 60 * 1000);
}

/** Todos los valores diarios agregados de un hábito (sin límite de rango), leídos de sus `HabitLog` — ver `aggregateForDate`. */
export function allDailyValues(habit: Habit, allLogs: HabitLog[]): Map<string, number> {
  const dates = new Set(allLogs.filter((l) => l.habitId === habit.id && l.value !== null).map((l) => l.date));
  const out = new Map<string, number>();
  for (const date of dates) {
    const agg = aggregateForDate(habit, allLogs, date);
    if (agg) out.set(date, agg.value);
  }
  return out;
}

/**
 * Promedio ponderado por recencia de los últimos 7 días (hoy incluido): los
 * días sin dato se excluyen por completo en vez de contar como 0. Si quedan
 * menos de `MIN_DAYS_FOR_VARIATION` días con dato, no hay comparación
 * confiable y se devuelve null.
 */
function weightedRecentAverage(daily: Map<string, number>, refKey: string): number | null {
  const pairs: { value: number; weight: number }[] = [];
  for (const [date, value] of daily) {
    const diff = Math.round(daysBetween(date, refKey));
    if (diff >= 0 && diff < RECENCY_WEIGHTS_7D.length) pairs.push({ value, weight: RECENCY_WEIGHTS_7D[diff] });
  }
  if (pairs.length < MIN_DAYS_FOR_VARIATION) return null;
  const totalWeight = pairs.reduce((s, p) => s + p.weight, 0);
  return pairs.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight;
}

function latestValue(daily: Map<string, number>, today: string): { value: number; date: string; isToday: boolean } | null {
  if (daily.size === 0) return null;
  const todayValue = daily.get(today);
  if (todayValue !== undefined) return { value: todayValue, date: today, isToday: true };
  const mostRecentDate = [...daily.keys()].sort((a, b) => b.localeCompare(a))[0];
  return { value: daily.get(mostRecentDate)!, date: mostRecentDate, isToday: false };
}

export function formatMetric(kind: HabitMetricKind, value: number, unit: string | null): string {
  if (kind === "steps") return Math.round(value).toLocaleString("es-AR");
  if (kind === "water") return `${(value / 1000).toFixed(1)}L`;
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${unit ? unit : ""}`;
}

export interface MetricKpi {
  metricKind: HabitMetricKind;
  habitId: string;
  label: string;
  displayValue: string;
  isToday: boolean;
  variationPct: number | null;
}

/** KPIs para la fila de Inicio: uno por cada hábito nativo de "Métricas" con algún dato cargado. */
export function getMetricKpis(habits: Habit[], habitLogs: HabitLog[], today: string): MetricKpi[] {
  const kpis: MetricKpi[] = [];
  for (const habit of habits) {
    if (!habit.metricKind || habit.archivedAt) continue;
    const daily = allDailyValues(habit, habitLogs);
    const latest = latestValue(daily, today);
    if (!latest) continue;

    const weightedAvg = weightedRecentAverage(daily, today);
    const variationPct = weightedAvg !== null && weightedAvg !== 0 ? ((latest.value - weightedAvg) / weightedAvg) * 100 : null;

    kpis.push({
      metricKind: habit.metricKind,
      habitId: habit.id,
      label: habit.name,
      displayValue: formatMetric(habit.metricKind, latest.value, habit.unit),
      isToday: latest.isToday,
      variationPct,
    });
  }
  return kpis;
}
