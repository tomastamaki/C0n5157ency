import type { LogsData } from "../types/logs";
import type { Habit, HabitLog, Metric } from "../types/habits";

/**
 * Forma de los datos durante la migración: igual a `LogsData` pero con una
 * versión numérica libre (no necesariamente la actual) y `habitLogs`
 * opcional, para poder representar estados intermedios (v1, v2) sin pelear
 * con el tipo literal de `LogsData.version`. Solo `upgradeLogsToV3` devuelve
 * un `LogsData` ya completo.
 */
export type MigratingLogs = Omit<LogsData, "version" | "habitLogs"> & { version: number; habitLogs?: HabitLog[] };

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
export function deriveMetricsFromLegacyLifestyle(logs: MigratingLogs): Metric[] {
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
export function upgradeLogsToV2(logs: MigratingLogs): MigratingLogs {
  const hasLegacyData =
    logs.bodyWeightEntries.length > 0 ||
    logs.sleepEntries.length > 0 ||
    logs.stepsEntries.length > 0 ||
    logs.waterEntries.length > 0;
  const needsMetricsDerivation = logs.metrics.length === 0 && hasLegacyData;
  if (logs.version >= 2 && !needsMetricsDerivation) return logs;
  return {
    ...logs,
    version: Math.max(logs.version, 2),
    habits: logs.habits ?? [],
    habitEntries: logs.habitEntries ?? [],
    metrics: needsMetricsDerivation ? deriveMetricsFromLegacyLifestyle(logs) : logs.metrics,
  };
}

/**
 * Migra cada `HabitEntry` de cantidad/tracking con `value` a un `HabitLog`
 * inicial (un registro por día, fecha y valor iguales a los que ya tenía la
 * entrada). Pura aditiva: no modifica ni borra `habitEntries`. Hábitos sin
 * `aggregation` (sí/no, tiempo, a evitar) no generan `HabitLog` — nunca
 * tuvieron el concepto de "varios registros por día".
 */
export function migrateHabitEntriesToLogs(logs: Pick<LogsData, "habits" | "habitEntries">): HabitLog[] {
  const aggregationById = new Map<string, Habit["aggregation"]>(logs.habits.map((h) => [h.id, h.aggregation]));
  const out: HabitLog[] = [];
  for (const entry of logs.habitEntries) {
    if (entry.value === null) continue;
    if (!aggregationById.get(entry.habitId)) continue;
    out.push({
      id: `migrated-${entry.id}`,
      habitId: entry.habitId,
      date: entry.date,
      value: entry.value,
      source: "manual",
      createdAt: entry.updatedAt,
      updatedAt: entry.updatedAt,
    });
  }
  return out;
}

/**
 * Sube a la versión 3: agrega `habitLogs`, derivado una sola vez de los
 * `HabitEntry` de cantidad/tracking existentes (ver `migrateHabitEntriesToLogs`).
 * Igual que con `metrics`, es idempotente — solo migra si `habitLogs` está
 * vacío y hay algo para migrar — y nunca toca `habitEntries`.
 */
export function upgradeLogsToV3(logs: MigratingLogs): LogsData {
  const v2 = upgradeLogsToV2(logs);
  const existingHabitLogs = v2.habitLogs ?? [];
  const needsLogMigration = existingHabitLogs.length === 0 && v2.habitEntries.some((e) => e.value !== null);
  return {
    ...v2,
    version: 3,
    habitLogs: needsLogMigration ? migrateHabitEntriesToLogs(v2) : existingHabitLogs,
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
export function verifyMigrationCounts(before: MigratingLogs, after: MigratingLogs): MigrationCounts {
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

export interface HabitLogMigrationCounts {
  entriesWithValueBefore: number;
  logsAfter: number;
  /** Suma de los `value` de las entradas migradas vs. la suma de los `HabitLog` resultantes: tienen que ser iguales. */
  valueSumBefore: number;
  valueSumAfter: number;
  ok: boolean;
}

/** Verifica que migrar HabitEntry → HabitLog no cambió ningún valor diario. */
export function verifyHabitLogMigration(logs: Pick<LogsData, "habits" | "habitEntries">, migratedLogs: HabitLog[]): HabitLogMigrationCounts {
  const aggregationById = new Map<string, Habit["aggregation"]>(logs.habits.map((h) => [h.id, h.aggregation]));
  const eligible = logs.habitEntries.filter((e) => e.value !== null && aggregationById.get(e.habitId));
  const entriesWithValueBefore = eligible.length;
  const valueSumBefore = eligible.reduce((sum, e) => sum + (e.value ?? 0), 0);
  const valueSumAfter = migratedLogs.reduce((sum, l) => sum + l.value, 0);
  return {
    entriesWithValueBefore,
    logsAfter: migratedLogs.length,
    valueSumBefore,
    valueSumAfter,
    ok: entriesWithValueBefore === migratedLogs.length && Math.abs(valueSumBefore - valueSumAfter) < 1e-9,
  };
}
