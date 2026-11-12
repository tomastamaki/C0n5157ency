import type { Habit, HabitLog } from "../types/habits";
import { addDays } from "./habitStreaks";
import { aggregateForDate, aggregateSecondaryForDate } from "./habitLogs";

export type TrendRange = 7 | 30 | 90;

export interface TrendPoint {
  date: string;
  /** null = sin registro ese día (no se inventa un cero). */
  value: number | null;
}

/**
 * Serie diaria del valor agregado del hábito para los últimos `range` días
 * hasta `asOf`, inclusive. Se calcula directo de los `HabitLog` (no del
 * `HabitEntry`): "tracking" nunca genera entry, así que leer de ahí dejaría
 * el gráfico siempre vacío para ese tipo aunque haya registros.
 */
export function buildHabitTrendSeries(habit: Habit, allLogs: HabitLog[], asOf: string, range: TrendRange): TrendPoint[] {
  const from = addDays(asOf, -(range - 1));
  const out: TrendPoint[] = [];
  for (let d = from; d <= asOf; d = addDays(d, 1)) {
    const agg = aggregateForDate(habit, allLogs, d);
    out.push({ date: d, value: agg ? agg.value : null });
  }
  return out;
}

/** Igual que `buildHabitTrendSeries` pero para `Habit.secondaryField` (ej. calidad de sueño). */
export function buildHabitSecondaryTrendSeries(habit: Habit, allLogs: HabitLog[], asOf: string, range: TrendRange): TrendPoint[] {
  const from = addDays(asOf, -(range - 1));
  const out: TrendPoint[] = [];
  for (let d = from; d <= asOf; d = addDays(d, 1)) {
    const agg = aggregateSecondaryForDate(habit, allLogs, d);
    out.push({ date: d, value: agg ? agg.value : null });
  }
  return out;
}

export function averageOf(points: TrendPoint[]): number | null {
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Promedio móvil de 7 días: en cada día, promedio de los valores no-nulos de esa fecha y las 6 anteriores (null si ninguno tiene dato). */
export function movingAverage7(points: TrendPoint[]): (number | null)[] {
  return points.map((_, i) => averageOf(points.slice(Math.max(0, i - 6), i + 1)));
}

/** Promedio de los últimos 7 días hasta `asOf` vs. los 7 días anteriores a esos. `null` si falta algún lado. */
export function changeVsPreviousWeek(habit: Habit, allLogs: HabitLog[], asOf: string): { deltaAbs: number; deltaPct: number } | null {
  const thisWeek = buildHabitTrendSeries(habit, allLogs, asOf, 7);
  const prevWeek = buildHabitTrendSeries(habit, allLogs, addDays(asOf, -7), 7);
  const avgNow = averageOf(thisWeek);
  const avgPrev = averageOf(prevWeek);
  if (avgNow === null || avgPrev === null || avgPrev === 0) return null;
  return { deltaAbs: avgNow - avgPrev, deltaPct: ((avgNow - avgPrev) / avgPrev) * 100 };
}
