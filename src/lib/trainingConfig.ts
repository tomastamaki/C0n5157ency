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
  /**
   * Criterio para subir de peso: las reps mandan, el RIR solo informa. Hasta esta cantidad
   * de reps por debajo del tope se tolera en UNA sola serie del grupo (con aviso ámbar) sin
   * bloquear la subida; dos o más series cortas, o una serie a más distancia que esta, sí
   * bloquean. También define "llegó al tope" al evaluar si una serie puede igualar el peso
   * de la anterior (fase de pesos distintos entre series). Fija a propósito: ante la duda, la
   * app prioriza la sobrecarga progresiva. No es configurable en Ajustes.
   */
  ceilingToleranceReps: 1,
  /**
   * Diferencia de RIR (objetivo − real) a partir de la cual se muestra un aviso ámbar
   * informativo (ej. RIR 0 contra un objetivo de RIR 2). El RIR ya no bloquea subir de peso;
   * por debajo de esta diferencia tampoco bloquea igualar el peso entre series. Fija a
   * propósito, no es configurable en Ajustes.
   */
  rirWarningGap: 2,
};
