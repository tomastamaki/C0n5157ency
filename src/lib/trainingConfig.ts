/**
 * Constantes nuevas del plan de referencias/progresión/sugerencias/descanso
 * (fases 1-6), todas editables en un solo lugar. Las constantes ya
 * existentes de módulos previos (PROGRESSION_CONFIG en e1rm.ts,
 * MUSCLE_RECOVERY_HOURS en recoveryConfig.ts, SUMMARY_CONFIG en
 * summaryConfig.ts) se dejan donde están para no tocar código ya estable;
 * esto es solo lo nuevo que se va agregando fase a fase.
 */
export const TRAINING_CONFIG = {
  /** Tolerancia (%) en la clasificación de progreso por serie/ejercicio (fase 2) antes de usar el cambio de e1RM como desempate. */
  progressTolerancePct: 1,
  /** Extensión del rango de reps hacia arriba (+1 a +2) cuando no se sube de peso (fase 2b). */
  rangeExtensionReps: 2,
  /** Si está apagado, al no llegar al piso del rango se repite el mismo peso en vez de ofrecer el rango extendido. */
  extendRangeEnabled: true,
};
