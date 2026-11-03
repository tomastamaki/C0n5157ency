/**
 * Todas las constantes del algoritmo de recomendación (Descansar / Normal /
 * Dale para adelante) viven acá, en un solo lugar, para poder ajustarlas con
 * la experiencia real de uso sin tocar la lógica en sí. Son estimaciones
 * iniciales, no valores calibrados.
 */

// ---- Capa 1: recuperación muscular ----
// El mapeo de qué músculos entrena cada ejercicio vive en `muscleMapping.ts`
// (fuente única, también usada por el resumen semanal/mensual y los chips
// de la card del día); acá solo quedan las horas de recuperación por músculo.

/** Horas de recuperación de referencia por músculo. */
export const MUSCLE_RECOVERY_HOURS: Record<string, number> = {
  Pecho: 48,
  Espalda: 60, // promedio del rango 48-72
  Hombros: 48,
  Bíceps: 36, // promedio del rango 24-48
  Tríceps: 48,
  Cuádriceps: 72,
  Isquiotibiales: 72,
  Glúteos: 72,
  Gemelos: 48,
  Abdomen: 24,
};

/** Ajuste del tiempo de recuperación según qué tan exigida estuvo la última sesión de ese músculo. */
export const RECOVERY_INTENSITY_ADJUSTMENT = {
  /** RIR promedio ≥ esto -> sesión liviana, se reduce el tiempo de recuperación. */
  lightRirThreshold: 2,
  lightReductionPct: 0.225, // punto medio del rango pedido (20-25%)
  /** RIR promedio ≤ esto -> sesión exigida, se usa el tiempo completo (o ampliado). */
  hardRirThreshold: 1,
  hardIncreasePct: 0.1,
};

/**
 * Cuánto "estímulo" (series ponderadas: 1 si el músculo es primario del
 * ejercicio, `SECONDARY_MUSCLE_WEIGHT` si es secundario — ver
 * `muscleMapping.ts`) hace falta para considerar que un músculo fue
 * efectivamente entrenado en una sesión, y cuánto escala el tiempo de
 * recuperación según ese volumen.
 */
export const MUSCLE_STIMULUS = {
  /** Por debajo de esto, el músculo no se considera "estimulado" (ej. 1 serie secundaria de cuádriceps en un día Push no cuenta como pierna entrenada). */
  minSeries: 3,
  /** A partir de esto (o más), se usa el 100% de las horas de recuperación. */
  fullVolumeSeries: 6,
  /** Factor aplicado a `minSeries` (el mínimo estimulado se recupera más rápido que una sesión de volumen completo). Entre `minSeries` y `fullVolumeSeries` escala lineal hasta 1. */
  minFactor: 0.5,
};

// ---- Capa 2: score de fatiga general ----

/** Cantidad de sesiones elegibles a considerar como máximo (promedio móvil ponderado). */
export const LAYER2_WINDOW_SIZE = 6;
/** Mínimo de sesiones elegibles para poder calcular la Capa 2. */
export const LAYER2_MIN_SESSIONS = 3;
/** Pesos por recencia, de la sesión más nueva a la más vieja dentro de la ventana. */
export const LAYER2_RECENCY_WEIGHTS = [6, 5, 4, 3, 2, 1];

/** Mínimo de noches con dato de sueño dentro de la ventana para incluir ese parámetro. */
export const SLEEP_MIN_NIGHTS = 2;

export const LAYER2_PARAM_WEIGHTS = {
  feeling: 1.5,
  rirDeviation: 1.5,
  sleep: 1.5,
  ownProgress: 1,
  setsCompleted: 1,
};

export const LAYER2_THRESHOLDS = {
  rest: -0.5,
  pushForward: 0.5,
};

/** Umbrales de clasificación (-1/0/+1) de cada parámetro individual. */
export const PARAM_THRESHOLDS = {
  rirDeviation: { low: -1, high: 1 },
  ownProgressPct: { low: -5, high: 5 }, // % de cambio de volumen (peso × reps) vs. historial reciente
  feeling: { low: 4, high: 7 }, // <4 mal, 4-6.9 normal, >=7 bien
  setsCompletedPct: { low: 80, high: 95 },
  sleepScore: { low: 50, high: 75 },
};
