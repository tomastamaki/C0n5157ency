/**
 * Multiplicador seguro para combinar ciclo + índice de programa en un único
 * número ordenable cronológicamente (el programa tiene 48 días, muy por
 * debajo de este span, así que nunca se pisan entre ciclos).
 */
export const CYCLE_SPAN = 100_000;

/** Clave ordenable: mayor número = más reciente, sin importar el ciclo. */
export function globalSeq(entry: { programIndex: number; cycle?: number }): number {
  return (entry.cycle ?? 0) * CYCLE_SPAN + entry.programIndex;
}
