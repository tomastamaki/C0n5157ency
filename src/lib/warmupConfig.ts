/**
 * Constantes del calentamiento sugerido (fase 4): porcentajes de la serie de
 * trabajo por cantidad de series de calentamiento, y descanso sugerido entre
 * ellas. Única fuente editable para estos valores.
 *
 * El `count` del programa ("0-1", "1", "1-2", "2-3") es un rango; se usa el
 * techo (máximo) como cantidad de series a sugerir, acotado a estas tablas.
 */
export const WARMUP_CONFIG = {
  maxTableSets: 4,
  percentagesBySetCount: {
    1: [0.6],
    2: [0.5, 0.75],
    3: [0.4, 0.6, 0.8],
    4: [0.4, 0.55, 0.7, 0.85],
  } as Record<number, number[]>,
  restSeconds: { min: 0, max: 60 },
};
