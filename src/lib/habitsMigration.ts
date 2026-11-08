import type { LogsData } from "../types/logs";
import type { Metric } from "../types/habits";

/**
 * Deriva `metrics[]` (un registro por fecha) a partir de las 4 colecciones
 * viejas de Lifestyle. Pura aditiva: nunca toca ni borra `bodyWeightEntries`/
 * `sleepEntries`/`stepsEntries`/`waterEntries`, que se dejan como están.
 *
 * - Peso, % grasa, masa muscular, puntaje de sueño, minutos de sueño
 *   profundo/despierto y pasos: un registro por fecha ya en los datos
 *   originales; si por algún motivo hay más de uno para la misma fecha, gana
 *   el de `updatedAt` más reciente (no se promedia ni se suma).
 * - Agua: varios registros pueden compartir fecha (se cargan por separado
 *   durante el día) y se SUMAN en `waterMl` — por eso la cantidad de
 *   `WaterEntry` no tiene por qué coincidir con la cantidad de `Metric` con
 *   `waterMl` seteado; lo que se preserva es el total en litros, no la
 *   cantidad de registros.
 * - `sleepH` (horas dormidas) es un campo nuevo: no hay de dónde migrarlo,
 *   queda `null` para todo el historial. Se completa hacia adelante.
 */
export function deriveMetricsFromLegacyLifestyle(logs: LogsData): Metric[] {
  const byDate = new Map<string, Metric>();
  const get = (date: string): Metric => {
    let m = byDate.get(date);
    if (!m) {
      m = {
        id: date,
        date,
        weightKg: null,
        bodyFatPct: null,
        muscleMassKg: null,
        sleepH: null,
        sleepScore: null,
        deepSleepMinutes: null,
        awakeMinutes: null,
        steps: null,
        waterMl: null,
        updatedAt: date,
      };
      byDate.set(date, m);
    }
    return m;
  };
  const newer = (a: string, b: string) => a >= b;

  for (const w of logs.bodyWeightEntries) {
    const m = get(w.date);
    if (m.weightKg === null || newer(w.updatedAt, m.updatedAt)) {
      m.weightKg = w.weightKg;
      m.bodyFatPct = w.bodyFatPct;
      m.muscleMassKg = w.muscleMassKg;
      m.updatedAt = w.updatedAt;
    }
  }
  for (const s of logs.sleepEntries) {
    const m = get(s.date);
    if (m.sleepScore === null || newer(s.updatedAt, m.updatedAt)) {
      m.sleepScore = s.score;
      m.deepSleepMinutes = s.deepSleepMinutes;
      m.awakeMinutes = s.awakeMinutes;
      m.updatedAt = s.updatedAt;
    }
  }
  for (const st of logs.stepsEntries) {
    const m = get(st.date);
    if (m.steps === null || newer(st.updatedAt, m.updatedAt)) {
      m.steps = st.steps;
      m.updatedAt = st.updatedAt;
    }
  }
  const waterSumMl = new Map<string, number>();
  for (const w of logs.waterEntries) {
    waterSumMl.set(w.date, (waterSumMl.get(w.date) ?? 0) + w.liters * 1000);
    const m = get(w.date);
    if (newer(w.updatedAt, m.updatedAt)) m.updatedAt = w.updatedAt;
  }
  for (const [date, ml] of waterSumMl) get(date).waterMl = Math.round(ml);

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Sube un `LogsData` de la versión 1 a la 2: agrega `habits`/`habitEntries`
 * (vacíos, no existían antes) y `metrics` (derivado de Lifestyle). Nunca
 * borra los arrays viejos.
 *
 * Idempotente por diseño: solo (re)deriva `metrics` cuando está vacío Y hay
 * datos viejos de Lifestyle de los que derivarlo. Si `metrics` ya tiene
 * contenido, se deja intacto (no se pisan ediciones hechas después desde la
 * UI de hábitos). Esto es deliberado incluso en el caso límite de que el
 * usuario borre absolutamente todos sus registros de métricas: como los
 * arrays viejos nunca se borran, quedan como red de seguridad y la próxima
 * carga los volvería a derivar — mismo espíritu que "nunca borrar los datos
 * originales hasta que se confirme".
 */
export function upgradeLogsToV2(logs: LogsData): LogsData {
  const hasLegacyData =
    logs.bodyWeightEntries.length > 0 ||
    logs.sleepEntries.length > 0 ||
    logs.stepsEntries.length > 0 ||
    logs.waterEntries.length > 0;
  const needsMetricsDerivation = logs.metrics.length === 0 && hasLegacyData;
  if (logs.version >= 2 && !needsMetricsDerivation) return logs;
  return {
    ...logs,
    version: 2,
    habits: logs.habits ?? [],
    habitEntries: logs.habitEntries ?? [],
    metrics: needsMetricsDerivation ? deriveMetricsFromLegacyLifestyle(logs) : logs.metrics,
  };
}

export interface MigrationCounts {
  weightBefore: number;
  weightAfter: number;
  sleepBefore: number;
  sleepAfter: number;
  stepsBefore: number;
  stepsAfter: number;
  /** El agua se compara por litros totales (ver nota de la función de arriba), no por cantidad de registros. */
  waterLitersBefore: number;
  waterLitersAfter: number;
  ok: boolean;
}

/** Verifica que la migración no perdió historial: cuenta registros (peso/sueño/pasos) y litros totales (agua) antes vs. después. */
export function verifyMigrationCounts(before: LogsData, after: LogsData): MigrationCounts {
  const weightBefore = before.bodyWeightEntries.length;
  const weightAfter = after.metrics.filter((m) => m.weightKg !== null).length;
  const sleepBefore = before.sleepEntries.length;
  const sleepAfter = after.metrics.filter((m) => m.sleepScore !== null).length;
  const stepsBefore = before.stepsEntries.length;
  const stepsAfter = after.metrics.filter((m) => m.steps !== null).length;
  const waterLitersBefore = before.waterEntries.reduce((sum, w) => sum + w.liters, 0);
  const waterLitersAfter = after.metrics.reduce((sum, m) => sum + (m.waterMl ?? 0), 0) / 1000;

  const ok =
    weightBefore === weightAfter &&
    sleepBefore === sleepAfter &&
    stepsBefore === stepsAfter &&
    Math.abs(waterLitersBefore - waterLitersAfter) < 1e-6;

  return { weightBefore, weightAfter, sleepBefore, sleepAfter, stepsBefore, stepsAfter, waterLitersBefore, waterLitersAfter, ok };
}
