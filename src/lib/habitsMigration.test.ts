import { describe, it, expect } from "vitest";
import {
  backfillHabitMetricFields,
  backfillLegacyAggregation,
  migrateHabitEntriesToLogs,
  seedNativeMetricHabits,
  upgradeLogsToV2,
  upgradeLogsToV3,
  upgradeLogsToV4,
  upgradeLogsToV5,
  verifyHabitLogMigration,
  type MigratingLogs,
} from "./habitsMigration";
import { EMPTY_LOGS } from "../types/logs";
import type { Habit, HabitEntry } from "../types/habits";

function logsV1(patch: Partial<MigratingLogs>): MigratingLogs {
  const { habitLogs: _unused, ...rest } = EMPTY_LOGS;
  return { ...rest, version: 1, ...patch };
}

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Tomar agua",
    icon: "drop",
    color: "azul",
    type: "quantity",
    unit: "ml",
    goal: 2500,
    aggregation: "sum",
    quickSteps: [250, 500],
    frequency: { kind: "daily" },
    category: "Salud",
    timeOfDay: "Todo el día",
    startDate: "2026-01-01",
    why: null,
    archivedAt: null,
    linked: null,
    metricKind: null,
    secondaryField: null,
    createdAt: "x",
    updatedAt: "x",
    ...patch,
  };
}

describe("upgradeLogsToV2", () => {
  it("sube la versión, agrega habits/habitEntries vacíos si no existían y backfillea aggregation", () => {
    const logs = logsV1({ habits: [{ ...habit(), aggregation: null }] });
    const upgraded = upgradeLogsToV2(logs);
    expect(upgraded.version).toBe(2);
    expect(upgraded.habits[0].aggregation).toBe("sum");
    expect(upgraded.habitEntries).toEqual([]);
  });

  it('un respaldo viejo con las 4 colecciones legacy de Lifestyle (HABI7 v2 Fase 6B) no rompe nada: ya no son parte del tipo, se descartan antes de llegar acá', () => {
    // `normalizeLogs` (lib/storage.ts) es quien arma este objeto leyendo campo por campo del JSON
    // crudo — acá simplemente no hay dónde ponerlas. Ver el describe "respaldo viejo" más abajo
    // para la prueba end-to-end con un JSON real que sí las trae.
    const upgraded = upgradeLogsToV2(logsV1({}));
    expect(upgraded.version).toBe(2);
  });
});

describe("migrateHabitEntriesToLogs", () => {
  function entry(patch: Partial<HabitEntry> = {}): HabitEntry {
    return { id: "e1", habitId: "h1", date: "2026-01-01", status: "done", value: null, source: "manual", updatedAt: "2026-01-01T08:00:00.000Z", ...patch };
  }

  it("genera un HabitLog por cada HabitEntry de cantidad con value, mismo día y valor", () => {
    const habits = [habit()];
    const habitEntries = [entry({ value: 750 })];
    const result = migrateHabitEntriesToLogs({ habits, habitEntries });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ habitId: "h1", date: "2026-01-01", value: 750, source: "manual" });
  });

  it("no genera HabitLog para entradas sin value (sí/no, a evitar, o cantidad sin cargar)", () => {
    const habits = [habit()];
    const habitEntries = [entry({ value: null })];
    expect(migrateHabitEntriesToLogs({ habits, habitEntries })).toEqual([]);
  });

  it("no genera HabitLog para hábitos sin aggregation (sí/no, tiempo, a evitar)", () => {
    const habits = [habit({ id: "h2", type: "yesno", aggregation: null })];
    const habitEntries = [entry({ habitId: "h2", value: 5 })];
    expect(migrateHabitEntriesToLogs({ habits, habitEntries })).toEqual([]);
  });
});

describe("backfillLegacyAggregation", () => {
  /** Simula un hábito tal como quedó guardado antes de que existiera `aggregation` (respaldo real pre-Fase-2): el campo directamente no está. */
  function legacyQuantityHabit(patch: Partial<Habit> = {}): Habit {
    const { aggregation: _unused, ...rest } = habit(patch);
    return rest as unknown as Habit;
  }

  it("a un hábito de cantidad sin 'aggregation' le asigna 'sum' (el viejo addQuantity siempre acumulaba)", () => {
    const [h] = backfillLegacyAggregation([legacyQuantityHabit()]);
    expect(h.aggregation).toBe("sum");
  });

  it("no toca un 'aggregation' ya elegido a propósito (ni 'sum' ni 'last')", () => {
    const [h1] = backfillLegacyAggregation([habit({ aggregation: "last" })]);
    expect(h1.aggregation).toBe("last");
    const [h2] = backfillLegacyAggregation([habit({ aggregation: "sum" })]);
    expect(h2.aggregation).toBe("sum");
  });

  it("no le agrega aggregation a hábitos de otro tipo (sí/no, tiempo, a evitar)", () => {
    const h = legacyQuantityHabit({ type: "yesno" });
    const [result] = backfillLegacyAggregation([h]);
    expect(result.aggregation).toBeUndefined();
  });
});

describe("upgradeLogsToV3 con datos reales pre-Fase-2 (hábito de cantidad sin 'aggregation')", () => {
  function legacyQuantityHabit(patch: Partial<Habit> = {}): Habit {
    const { aggregation: _unused, ...rest } = habit(patch);
    return rest as unknown as Habit;
  }

  it("migra el HabitEntry existente a un HabitLog con el mismo valor (antes solo se perdía: 0 logs)", () => {
    const habits = [legacyQuantityHabit()];
    const habitEntries: HabitEntry[] = [{ id: "e1", habitId: "h1", date: "2026-11-11", status: "partial", value: 1250, source: "manual", updatedAt: "x" }];
    const logs = logsV1({ habits, habitEntries, version: 2 });
    const v3 = upgradeLogsToV3(logs);

    expect(v3.habits[0].aggregation).toBe("sum");
    expect(v3.habitLogs).toHaveLength(1);
    expect(v3.habitLogs[0]).toMatchObject({ habitId: "h1", date: "2026-11-11", value: 1250 });
    // El valor diario (HabitEntry) no cambia, solo se agrega el log derivado.
    expect(v3.habitEntries).toEqual(habitEntries);
  });
});

describe("verifyHabitLogMigration / upgradeLogsToV3", () => {
  it("ok=true cuando la cantidad de logs y la suma de valores coincide con las entradas elegibles", () => {
    const habits = [habit()];
    const habitEntries: HabitEntry[] = [
      { id: "e1", habitId: "h1", date: "2026-01-01", status: "done", value: 2500, source: "manual", updatedAt: "x" },
      { id: "e2", habitId: "h1", date: "2026-01-02", status: "partial", value: 1000, source: "manual", updatedAt: "x" },
    ];
    const migrated = migrateHabitEntriesToLogs({ habits, habitEntries });
    const result = verifyHabitLogMigration({ habits, habitEntries }, migrated);
    expect(result.ok).toBe(true);
    expect(result.entriesWithValueBefore).toBe(2);
    expect(result.logsAfter).toBe(2);
    expect(result.valueSumBefore).toBe(3500);
    expect(result.valueSumAfter).toBe(3500);
  });

  it("upgradeLogsToV3 migra una sola vez (idempotente) y nunca borra habitEntries", () => {
    const habits = [habit()];
    const habitEntries: HabitEntry[] = [{ id: "e1", habitId: "h1", date: "2026-01-01", status: "done", value: 2500, source: "manual", updatedAt: "x" }];
    const logs = logsV1({ habits, habitEntries, version: 2 });
    const v3 = upgradeLogsToV3(logs);
    expect(v3.version).toBe(3);
    expect(v3.habitLogs).toHaveLength(1);
    expect(v3.habitEntries).toHaveLength(1); // intacto

    // Si el usuario borra manualmente todos sus HabitLog, no se vuelven a regenerar de la nada en la próxima carga
    // (serían duplicados si además ya cargó nuevos a mano) — pero mientras existan entries migrables y habitLogs
    // esté vacío, sí se re-derivan, mismo espíritu que en Fase 6A.
    const v3Again = upgradeLogsToV3(v3);
    expect(v3Again.habitLogs).toHaveLength(1);
  });
});

describe("backfillHabitMetricFields", () => {
  /** Simula un hábito guardado antes de Fase 6: metricKind/secondaryField directamente no existen. */
  function legacyHabit(patch: Partial<Habit> = {}): Habit {
    const { metricKind: _m, secondaryField: _s, ...rest } = habit(patch);
    return rest as unknown as Habit;
  }

  it("completa metricKind/secondaryField en null cuando no existían", () => {
    const [h] = backfillHabitMetricFields([legacyHabit()]);
    expect(h.metricKind).toBeNull();
    expect(h.secondaryField).toBeNull();
  });

  it("no pisa un metricKind ya seteado", () => {
    const [h] = backfillHabitMetricFields([habit({ metricKind: "steps" })]);
    expect(h.metricKind).toBe("steps");
  });
});

describe("seedNativeMetricHabits (HABI7 v2 Fase 6A)", () => {
  const TODAY = "2026-11-12";

  it("sin hábitos previos, crea los 4 nativos con sus valores por defecto", () => {
    const habits = seedNativeMetricHabits([], TODAY);
    const byKind = Object.fromEntries(habits.map((h) => [h.metricKind, h]));

    expect(byKind.weight).toMatchObject({ name: "Peso", type: "tracking", unit: "kg", goal: null, category: "Métricas" });
    expect(byKind.sleep).toMatchObject({ name: "Sueño", type: "tracking", unit: "h", goal: 8, category: "Métricas" });
    expect(byKind.sleep.secondaryField).toMatchObject({ key: "quality", min: 0, max: 100 });
    expect(byKind.steps).toMatchObject({ name: "Pasos", type: "tracking", unit: "pasos", goal: 8000, category: "Métricas" });
    expect(byKind.water).toMatchObject({ name: "Agua", type: "quantity", aggregation: "sum", unit: "ml", goal: 2500, category: "Métricas" });
  });

  it("es idempotente: correrlo de nuevo sobre el resultado no duplica nada", () => {
    const first = seedNativeMetricHabits([], TODAY);
    const second = seedNativeMetricHabits(first, TODAY);
    expect(second).toHaveLength(4);
    expect(second.filter((h) => h.metricKind === "steps")).toHaveLength(1);
  });

  it("convierte un hábito vinculado a pasos/agua en el nativo, sin perder su id (historial intacto)", () => {
    const linkedSteps = habit({ id: "real-steps-id", name: "Pasos", linked: { source: "steps" } as never, goal: 9000 });
    const [h] = seedNativeMetricHabits([linkedSteps], TODAY);
    expect(h.id).toBe("real-steps-id");
    expect(h.metricKind).toBe("steps");
    expect(h.category).toBe("Métricas");
    expect(h.linked).toBeNull();
    expect(h.goal).toBe(9000); // conserva su propio objetivo, no se pisa con el default
  });

  it('a falta de un hábito vinculado al agua, convierte "Tomar agua" (decisión puntual del usuario) y lo renombra a "Agua"', () => {
    const tomarAgua = habit({ id: "real-water-id", name: "Tomar agua", type: "quantity", linked: null, goal: 2500 });
    const habits = seedNativeMetricHabits([tomarAgua], TODAY);
    const water = habits.find((h) => h.metricKind === "water");
    expect(water?.id).toBe("real-water-id");
    expect(water?.name).toBe("Agua");
    expect(habits.filter((h) => h.metricKind === "water")).toHaveLength(1);
  });

  it('sueño nunca se convierte: un hábito vinculado a "sleep" se desvincula pero queda intacto, y "Sueño" arranca vacío', () => {
    const dormir = habit({ id: "real-sleep-id", name: "Dormir", type: "time", linked: { source: "sleep" } as never, goal: 7 });
    const habits = seedNativeMetricHabits([dormir], TODAY);

    const dormirAfter = habits.find((h) => h.id === "real-sleep-id");
    expect(dormirAfter).toMatchObject({ name: "Dormir", type: "time", goal: 7, linked: null, metricKind: null });

    const sueno = habits.find((h) => h.metricKind === "sleep");
    expect(sueno?.id).not.toBe("real-sleep-id");
    expect(sueno).toMatchObject({ name: "Sueño", goal: 8 });
  });
});

describe("upgradeLogsToV4", () => {
  it("sube a la versión 4 y siembra los 4 hábitos nativos", () => {
    const logs = logsV1({ version: 3 });
    const v4 = upgradeLogsToV4(logs, "2026-11-12");
    expect(v4.version).toBe(4);
    expect(v4.habits.filter((h) => h.metricKind !== null)).toHaveLength(4);
  });

  it("es idempotente end-to-end", () => {
    const logs = logsV1({ version: 3 });
    const v4 = upgradeLogsToV4(logs, "2026-11-12");
    const v4Again = upgradeLogsToV4(v4, "2026-11-12");
    expect(v4Again.habits.filter((h) => h.metricKind !== null)).toHaveLength(4);
  });
});

describe("upgradeLogsToV5 (HABI7 v2 Fase 6B: borrado de Lifestyle legacy)", () => {
  it("sube a la versión 5 sin tocar sesiones, hábitos, entradas ni logs", () => {
    const sessionsIn = [{ id: "s1" }] as never[];
    const logs = logsV1({ version: 4, sessions: sessionsIn, habits: [habit()] });
    const v5 = upgradeLogsToV5(logs, "2026-11-12");
    expect(v5.version).toBe(5);
    expect(v5.sessions).toEqual(sessionsIn);
    expect(v5.habits.some((h) => h.id === "h1")).toBe(true);
  });

  // El descarte real de las colecciones legacy de un respaldo viejo pasa por `normalizeLogs`
  // (lib/storage.ts), que arma el objeto a migrar leyendo campo por campo del JSON crudo — ahí es
  // donde de verdad no se copian. Ver `storage.test.ts` para esa prueba end-to-end con un JSON
  // viejo simulado.
});
