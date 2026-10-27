export interface RepRange {
  min: number;
  max: number;
}

/**
 * Interpreta el string de reps prescriptas del programa ("6-8", "10", "20",
 * "10 per leg") como un rango numérico. Un número fijo es un rango de ese
 * único valor; el sufijo libre ("per leg") se ignora.
 */
export function parseRepRange(reps: string): RepRange {
  const match = reps.match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return { min: 0, max: 0 };
  const min = Number(match[1]);
  const max = match[2] !== undefined ? Number(match[2]) : min;
  return { min, max };
}

/** Distancia en reps entre un valor y un rango (0 si ya está adentro). */
export function repRangeDistance(actualReps: number, range: RepRange): number {
  if (actualReps < range.min) return range.min - actualReps;
  if (actualReps > range.max) return actualReps - range.max;
  return 0;
}

export function isWithinRepTolerance(actualReps: number, range: RepRange, tolerance: number): boolean {
  return repRangeDistance(actualReps, range) <= tolerance;
}
