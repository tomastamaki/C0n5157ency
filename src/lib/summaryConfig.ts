/**
 * Constantes del resumen semanal/mensual y de la referencia cruzada entre
 * rutinas, todas en un solo lugar para poder ajustarlas sin tocar la lógica.
 */
export const SUMMARY_CONFIG = {
  /** Tolerancia en reps para considerar que una serie histórica cae dentro de un rango prescripto, al buscar referencia de otro día/rutina. */
  repRangeTolerance: 1,
  /** |variación de e1RM| por debajo de este % se considera "Estable" (si no, "Progresa" o "Baja"). */
  exerciseStatusStablePct: 1,
  /** Excedente mínimo de RIR (real − objetivo) para que un ejercicio entre en el destacado "Margen para subir". */
  marginToPushMinRirSurplus: 1,
};
