import type { BodyWeightEntry, SleepEntry, StepsEntry, WaterEntry } from "../types/logs";

/** Días distintos con datos que hacen falta en cada ventana semanal para mostrar una comparación confiable. */
const MIN_DAYS_FOR_TREND = 3;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(dateKey: string, refKey: string): number {
  return (new Date(refKey).getTime() - new Date(dateKey).getTime()) / (24 * 60 * 60 * 1000);
}

/** Combina registros por fecha: "sum" para métricas acumulables en el día (pasos, agua), "last" para valores puntuales (peso, sueño). */
function dailyValues<T>(
  entries: T[],
  dateOf: (e: T) => string,
  valueOf: (e: T) => number,
  combine: "sum" | "last"
): Map<string, number> {
  const byDate = new Map<string, number[]>();
  for (const e of entries) {
    const date = dateOf(e);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(valueOf(e));
  }
  const result = new Map<string, number>();
  for (const [date, values] of byDate) {
    result.set(date, combine === "sum" ? values.reduce((a, b) => a + b, 0) : values[values.length - 1]);
  }
  return result;
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function weekWindowAverage(daily: Map<string, number>, refKey: string, startDaysAgo: number, endDaysAgo: number): number | null {
  const values: number[] = [];
  for (const [date, value] of daily) {
    const diff = daysBetween(date, refKey);
    if (diff >= startDaysAgo && diff < endDaysAgo) values.push(value);
  }
  if (values.length < MIN_DAYS_FOR_TREND) return null;
  return average(values);
}

export type TrendGoodness = "up-is-good" | "down-is-good" | "neutral";

export interface LifestyleKpi {
  key: "weight" | "sleep" | "steps" | "water";
  label: string;
  displayValue: string;
  isToday: boolean;
  variationPct: number | null;
  goodness: TrendGoodness;
}

function buildKpi<T>(
  key: LifestyleKpi["key"],
  label: string,
  entries: T[],
  dateOf: (e: T) => string,
  valueOf: (e: T) => number,
  combine: "sum" | "last",
  format: (value: number) => string,
  goodness: TrendGoodness
): LifestyleKpi | null {
  if (entries.length === 0) return null;
  const today = todayKey();
  const daily = dailyValues(entries, dateOf, valueOf, combine);

  const todayValue = daily.get(today);
  let value: number;
  let isToday: boolean;
  if (todayValue !== undefined) {
    value = todayValue;
    isToday = true;
  } else {
    const mostRecentDate = [...daily.keys()].sort((a, b) => b.localeCompare(a))[0];
    value = daily.get(mostRecentDate)!;
    isToday = false;
  }

  const thisWeek = weekWindowAverage(daily, today, 0, 7);
  const lastWeek = weekWindowAverage(daily, today, 7, 14);
  const variationPct = thisWeek !== null && lastWeek !== null && lastWeek !== 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : null;

  return { key, label, displayValue: format(value), isToday, variationPct, goodness };
}

export interface LifestyleKpisInput {
  bodyWeightEntries: BodyWeightEntry[];
  sleepEntries: SleepEntry[];
  stepsEntries: StepsEntry[];
  waterEntries: WaterEntry[];
}

export function getLifestyleKpis(logs: LifestyleKpisInput): LifestyleKpi[] {
  const kpis = [
    buildKpi(
      "weight",
      "Peso",
      logs.bodyWeightEntries,
      (e) => e.date,
      (e) => e.weightKg,
      "last",
      (v) => `${v}kg`,
      "neutral"
    ),
    buildKpi(
      "sleep",
      "Sueño",
      logs.sleepEntries,
      (e) => e.date,
      (e) => e.score,
      "last",
      (v) => `${Math.round(v)}/100`,
      "up-is-good"
    ),
    buildKpi(
      "steps",
      "Pasos",
      logs.stepsEntries,
      (e) => e.date,
      (e) => e.steps,
      "sum",
      (v) => Math.round(v).toLocaleString("es-AR"),
      "up-is-good"
    ),
    buildKpi(
      "water",
      "Agua",
      logs.waterEntries,
      (e) => e.date,
      (e) => e.liters,
      "sum",
      (v) => `${v.toFixed(1)}L`,
      "up-is-good"
    ),
  ];
  return kpis.filter((k): k is LifestyleKpi => k !== null);
}
