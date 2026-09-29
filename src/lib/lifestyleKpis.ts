import type { BodyWeightEntry, SleepEntry, StepsEntry, WaterEntry } from "../types/logs";
import { formatDateOnly } from "./time";

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

function latestValue(daily: Map<string, number>, today: string): { value: number; date: string; isToday: boolean } | null {
  if (daily.size === 0) return null;
  const todayValue = daily.get(today);
  if (todayValue !== undefined) return { value: todayValue, date: today, isToday: true };
  const mostRecentDate = [...daily.keys()].sort((a, b) => b.localeCompare(a))[0];
  return { value: daily.get(mostRecentDate)!, date: mostRecentDate, isToday: false };
}

export type TrendGoodness = "up-is-good" | "down-is-good" | "neutral";
export type LifestyleMetricKey = "weight" | "sleep" | "steps" | "water";

interface MetricConfig<T> {
  key: LifestyleMetricKey;
  label: string;
  entries: T[];
  dateOf: (e: T) => string;
  valueOf: (e: T) => number;
  combine: "sum" | "last";
  format: (value: number) => string;
  goodness: TrendGoodness;
}

export interface LifestyleKpisInput {
  bodyWeightEntries: BodyWeightEntry[];
  sleepEntries: SleepEntry[];
  stepsEntries: StepsEntry[];
  waterEntries: WaterEntry[];
}

function metricConfigs(logs: LifestyleKpisInput): MetricConfig<unknown>[] {
  return [
    {
      key: "weight",
      label: "Peso",
      entries: logs.bodyWeightEntries,
      dateOf: (e) => (e as BodyWeightEntry).date,
      valueOf: (e) => (e as BodyWeightEntry).weightKg,
      combine: "last",
      format: (v) => `${v}kg`,
      goodness: "neutral",
    },
    {
      key: "sleep",
      label: "Sueño",
      entries: logs.sleepEntries,
      dateOf: (e) => (e as SleepEntry).date,
      valueOf: (e) => (e as SleepEntry).score,
      combine: "last",
      format: (v) => `${Math.round(v)}/100`,
      goodness: "up-is-good",
    },
    {
      key: "steps",
      label: "Pasos",
      entries: logs.stepsEntries,
      dateOf: (e) => (e as StepsEntry).date,
      valueOf: (e) => (e as StepsEntry).steps,
      combine: "sum",
      format: (v) => Math.round(v).toLocaleString("es-AR"),
      goodness: "up-is-good",
    },
    {
      key: "water",
      label: "Agua",
      entries: logs.waterEntries,
      dateOf: (e) => (e as WaterEntry).date,
      valueOf: (e) => (e as WaterEntry).liters,
      combine: "sum",
      format: (v) => `${v.toFixed(1)}L`,
      goodness: "up-is-good",
    },
  ];
}

export interface LifestyleKpi {
  key: LifestyleMetricKey;
  label: string;
  displayValue: string;
  isToday: boolean;
  variationPct: number | null;
  goodness: TrendGoodness;
}

/** KPIs para la fila de Inicio: solo las métricas que ya tienen algún dato cargado. */
export function getLifestyleKpis(logs: LifestyleKpisInput): LifestyleKpi[] {
  const today = todayKey();
  const kpis: LifestyleKpi[] = [];

  for (const cfg of metricConfigs(logs)) {
    if (cfg.entries.length === 0) continue;
    const daily = dailyValues(cfg.entries, cfg.dateOf, cfg.valueOf, cfg.combine);
    const latest = latestValue(daily, today);
    if (!latest) continue;

    const thisWeek = weekWindowAverage(daily, today, 0, 7);
    const lastWeek = weekWindowAverage(daily, today, 7, 14);
    const variationPct =
      thisWeek !== null && lastWeek !== null && lastWeek !== 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : null;

    kpis.push({
      key: cfg.key,
      label: cfg.label,
      displayValue: cfg.format(latest.value),
      isToday: latest.isToday,
      variationPct,
      goodness: cfg.goodness,
    });
  }
  return kpis;
}

export interface MetricPreview {
  key: LifestyleMetricKey;
  label: string;
  preview: string;
  hasData: boolean;
}

/** Vistazo rápido para las 4 cards de la pantalla principal de Lifestyle: siempre las 4, "Sin datos" si corresponde. */
export function getMetricPreviews(logs: LifestyleKpisInput): MetricPreview[] {
  const today = todayKey();

  return metricConfigs(logs).map((cfg) => {
    if (cfg.entries.length === 0) {
      return { key: cfg.key, label: cfg.label, preview: "Sin datos", hasData: false };
    }
    const daily = dailyValues(cfg.entries, cfg.dateOf, cfg.valueOf, cfg.combine);
    const latest = latestValue(daily, today);
    if (!latest) return { key: cfg.key, label: cfg.label, preview: "Sin datos", hasData: false };

    const when = latest.isToday ? "hoy" : formatDateOnly(latest.date);
    const unit = cfg.key === "steps" ? " pasos" : "";
    return { key: cfg.key, label: cfg.label, preview: `${cfg.format(latest.value)}${unit} — ${when}`, hasData: true };
  });
}
