/**
 * Constantes del motor de hábitos (HABI7), todas editables en un solo lugar.
 * Sin opción equivalente en la app ni en Ajustes: son parte del diseño, no
 * preferencias del usuario.
 */
export const HABITS_CONFIG = {
  /** % de hábitos programados del día que hace que ese día cuente para la racha global. */
  globalStreakPct: 0.6,
  /** Mínimo de hábitos programados ese día para que el día entre en el cálculo de la racha global; con menos, ese día no se evalúa (ni suma ni resta). */
  globalStreakMinHabits: 2,
  /** "Lo de hace 14 días pesa la mitad" en el puntaje de constancia estilo Loop Habit Tracker. */
  consistencyHalfLifeDays: 14,
  /** Hitos de racha que disparan la tarjeta de celebración (una sola vez cada uno). */
  milestones: [7, 30, 100] as const,
  /** Umbrales de proporción hecha/programada que separan los niveles 1/2/3 del mapa de calor global. */
  globalHeatLevelThresholds: [0.4, 0.8] as const,
};
