import type { LogsData } from "../types/logs";
import type { Habit, HabitLog, HabitSecondaryField, Metric } from "../types/habits";

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
 * Hábitos de cantidad creados antes de que existiera `aggregation` (versión
 * del esquema previa a HABI7 v2 Fase 2) no tienen ese campo. El modelo viejo
 * (`addQuantity`, ver historial de `habitActions.ts`) siempre ACUMULABA el
 * valor del día (`previous.value + amount`): el equivalente exacto de "sum".
 * Backfillea solo eso — nunca pisa un `aggregation` ya seteado (ni "sum" ni
 * "last" elegidos a propósito al crear/editar un hábito con la UI nueva), y
 * nunca toca hábitos de otro tipo (tracking es un tipo nuevo, no pudo existir
 * sin este campo).
 */
export function backfillLegacyAggregation(habits: Habit[]): Habit[] {
  return habits.map((h) => (h.type === "quantity" && !h.aggregation ? { ...h, aggregation: "sum" as const } : h));
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
  return {
    ...logs,
    version: Math.max(logs.version, 2),
    habits: backfillLegacyAggregation(logs.habits ?? []),
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
      secondaryValue: null,
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
 *
 * Devuelve `MigratingLogs` (no `LogsData` todavía): esta versión intermedia
 * nunca se guarda sola, siempre sigue hacia `upgradeLogsToV4`, que es la que
 * cierra el esquema actual.
 */
export function upgradeLogsToV3(logs: MigratingLogs): MigratingLogs & { habitLogs: HabitLog[] } {
  const v2 = upgradeLogsToV2(logs);
  const existingHabitLogs = v2.habitLogs ?? [];
  const needsLogMigration = existingHabitLogs.length === 0 && v2.habitEntries.some((e) => e.value !== null);
  return {
    ...v2,
    version: 3,
    habitLogs: needsLogMigration ? migrateHabitEntriesToLogs(v2) : existingHabitLogs,
  };
}

/**
 * Campo secundario del hábito nativo "Sueño" (HABI7 v2 Fase 6): calidad de
 * sueño 0-100, mismo concepto que el viejo `SleepEntry.score` pero cargado a
 * mano junto a las horas, no migrado automáticamente (ver `upgradeLogsToV4`).
 */
export const SLEEP_QUALITY_FIELD: HabitSecondaryField = {
  key: "quality",
  label: "Calidad",
  unit: null,
  min: 0,
  max: 100,
  quickValues: [50, 65, 75, 85],
  defaultValue: 50,
};

/** Nombre del hábito de agua manual preexistente que, a falta de un hábito vinculado, se convierte en el nativo "Agua" (decisión explícita del usuario en Fase 6A: su "Tomar agua" real ya tenía historial). */
const FALLBACK_WATER_HABIT_NAME = "Tomar agua";

/** IDs fijos de los 4 hábitos nativos creados desde cero, para que sean estables entre dispositivos (nunca se duplican al sincronizar). Un hábito convertido desde uno ya existente conserva su propio id. */
const NATIVE_METRIC_IDS = {
  weight: "metric-weight",
  sleep: "metric-sleep",
  steps: "metric-steps",
  water: "metric-water",
} as const;

/**
 * Hábitos de versiones anteriores a esta fase no tienen `metricKind` ni
 * `secondaryField` (el campo directamente no existe en el JSON guardado, no
 * es `null`) — completarlos es necesario para que las comparaciones
 * `h.metricKind === "agua"` etc. funcionen. Pura aditiva.
 */
export function backfillHabitMetricFields(habits: Habit[]): Habit[] {
  return habits.map((h) => ({ ...h, metricKind: h.metricKind ?? null, secondaryField: h.secondaryField ?? null }));
}

/** Mismo backfill que `backfillHabitMetricFields`, para `HabitLog.secondaryValue`. */
export function backfillHabitLogSecondaryValue(logs: HabitLog[]): HabitLog[] {
  return logs.map((l) => ({ ...l, secondaryValue: l.secondaryValue ?? null }));
}

/**
 * Crea (o convierte, cuando ya existía un hábito vinculado o — solo para
 * agua — el hábito manual "Tomar agua") los 4 hábitos nativos de la
 * categoría "Métricas": Peso, Sueño, Pasos, Agua. Idempotente por
 * `metricKind`: nunca crea un segundo hábito para la misma métrica, archivado
 * o no.
 *
 * Reglas de conversión (HABI7 v2 Fase 6A, decisiones explícitas del usuario):
 * - Pasos/Agua: si hay un hábito vinculado (`linked.source`) a esa fuente,
 *   se convierte en el nativo sin tocar su historial (mismo id). Para agua,
 *   a falta de uno vinculado, se convierte "Tomar agua" si existe (ver
 *   `FALLBACK_WATER_HABIT_NAME`) — es un caso puntual de este usuario, no
 *   una regla general por nombre.
 * - Sueño: NUNCA se convierte nada existente. Si había un hábito vinculado a
 *   "sleep" (ej. "Dormir"), se desvincula y queda como un hábito normal,
 *   intacto; el nativo "Sueño" siempre arranca vacío.
 * - Peso: siempre se crea nuevo (no existía el concepto de hábito vinculado
 *   a peso).
 */
export function seedNativeMetricHabits(habits: Habit[], today: string): Habit[] {
  const normalized = backfillHabitMetricFields(habits);
  const now = new Date().toISOString();

  // "sleep" nunca se convierte: se desvincula y se deja como hábito normal (ver docstring).
  let result = normalized.map((h) =>
    (h.linked?.source as string | undefined) === "sleep" ? { ...h, linked: null } : h
  );

  const hasWeight = result.some((h) => h.metricKind === "weight");
  const hasSleep = result.some((h) => h.metricKind === "sleep");
  const hasSteps = result.some((h) => h.metricKind === "steps");
  const hasWater = result.some((h) => h.metricKind === "water");

  const seeded: Habit[] = [];

  if (!hasWeight) {
    seeded.push({
      id: NATIVE_METRIC_IDS.weight,
      name: "Peso",
      icon: "scale",
      color: "pizarra",
      type: "tracking",
      unit: "kg",
      goal: null,
      quickSteps: [],
      aggregation: "last",
      frequency: { kind: "daily" },
      category: "Métricas",
      timeOfDay: "Todo el día",
      startDate: today,
      why: null,
      archivedAt: null,
      linked: null,
      metricKind: "weight",
      secondaryField: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!hasSleep) {
    seeded.push({
      id: NATIVE_METRIC_IDS.sleep,
      name: "Sueño",
      icon: "moon",
      color: "violeta",
      type: "tracking",
      unit: "h",
      goal: 8,
      quickSteps: [6, 7, 8, 9],
      aggregation: "last",
      frequency: { kind: "daily" },
      category: "Métricas",
      timeOfDay: "Noche",
      startDate: today,
      why: null,
      archivedAt: null,
      linked: null,
      metricKind: "sleep",
      secondaryField: SLEEP_QUALITY_FIELD,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!hasSteps) {
    const linked = result.find((h) => !h.archivedAt && (h.linked?.source as string | undefined) === "steps");
    if (linked) {
      result = result.map((h) =>
        h.id === linked.id
          ? { ...h, linked: null, category: "Métricas" as const, metricKind: "steps" as const, type: "tracking" as const, aggregation: "last" as const }
          : h
      );
    } else {
      seeded.push({
        id: NATIVE_METRIC_IDS.steps,
        name: "Pasos",
        icon: "walk",
        color: "verde",
        type: "tracking",
        unit: "pasos",
        goal: 8000,
        quickSteps: [],
        aggregation: "last",
        frequency: { kind: "daily" },
        category: "Métricas",
        timeOfDay: "Todo el día",
        startDate: today,
        why: null,
        archivedAt: null,
        linked: null,
        metricKind: "steps",
        secondaryField: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (!hasWater) {
    const linked = result.find((h) => !h.archivedAt && (h.linked?.source as string | undefined) === "water");
    const fallback = result.find(
      (h) => !h.archivedAt && h.metricKind === null && h.type === "quantity" && h.name === FALLBACK_WATER_HABIT_NAME
    );
    const existing = linked ?? fallback;
    if (existing) {
      result = result.map((h) =>
        h.id === existing.id ? { ...h, linked: null, category: "Métricas" as const, metricKind: "water" as const, name: "Agua" } : h
      );
    } else {
      seeded.push({
        id: NATIVE_METRIC_IDS.water,
        name: "Agua",
        icon: "drop",
        color: "azul",
        type: "quantity",
        unit: "ml",
        goal: 2500,
        quickSteps: [250, 500],
        aggregation: "sum",
        frequency: { kind: "daily" },
        category: "Métricas",
        timeOfDay: "Todo el día",
        startDate: today,
        why: null,
        archivedAt: null,
        linked: null,
        metricKind: "water",
        secondaryField: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return [...result, ...seeded];
}

/**
 * Sube a la versión 4 (HABI7 v2 Fase 6A): crea/convierte los 4 hábitos
 * nativos de "Métricas" (ver `seedNativeMetricHabits`) y completa los campos
 * nuevos de hábitos y registros viejos. Idempotente — correr esto de nuevo
 * sobre datos ya en v4 no crea duplicados ni pisa nada.
 */
export function upgradeLogsToV4(logs: MigratingLogs, today: string = new Date().toISOString().slice(0, 10)): LogsData {
  const v3 = upgradeLogsToV3(logs);
  return {
    ...v3,
    version: 4,
    habits: seedNativeMetricHabits(v3.habits, today),
    habitLogs: backfillHabitLogSecondaryValue(v3.habitLogs),
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
  const valueSumAfter = migratedLogs.reduce((sum, l) => sum + (l.value ?? 0), 0);
  return {
    entriesWithValueBefore,
    logsAfter: migratedLogs.length,
    valueSumBefore,
    valueSumAfter,
    ok: entriesWithValueBefore === migratedLogs.length && Math.abs(valueSumBefore - valueSumAfter) < 1e-9,
  };
}
