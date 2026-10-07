/**
 * Constantes del cálculo de progresión por e1RM (1RM estimado ajustado por
 * RIR) y de la detección de estancamiento. Todo en un solo lugar para poder
 * ajustarlas sin tocar la lógica.
 */
export const PROGRESSION_CONFIG = {
  /** Divisor de la fórmula de Epley: e1RM = peso × (1 + reps_efectivas / divisor). */
  epleyDivisor: 30,
  /** Cantidad mínima de sesiones consecutivas sin mejora para marcar un ejercicio como estancado. */
  stalledSessionCount: 3,
  /** Sesiones consecutivas más recientes con e1RM por debajo del promedio previo para marcar "necesita atención". */
  attentionDeclineSessionCount: 2,
  /** Margen de tolerancia (%) antes de considerar que el e1RM bajó: evita marcar por ruido normal entre sesiones. */
  attentionTolerancePct: 5,
};

/**
 * 1RM estimado ajustado por esfuerzo: las "reps efectivas" suman el RIR a
 * las reps hechas, así que una serie con más reps en reserva (más fácil)
 * pesa menos que una al fallo con las mismas reps. Esto evita que la
 * progresión se vea "plana" cuando en realidad subieron las reps o bajó el
 * esfuerzo al mismo peso.
 */
export function estimatedE1RM(weightKg: number, reps: number, rir: number): number {
  const effectiveReps = reps + rir;
  return weightKg * (1 + effectiveReps / PROGRESSION_CONFIG.epleyDivisor);
}
