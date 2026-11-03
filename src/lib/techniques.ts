import type { LoggedSet, TechniqueExtra } from "../types/logs";
import { roundToStep } from "./suggestions";
import { TECHNIQUE_CATALOG, TECHNIQUE_CONFIG, type TechniqueCatalogEntry } from "./techniqueConfig";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Reconoce la técnica del texto libre del programa (`group.intensityTechnique`), o null si no matchea ninguna del catálogo. */
export function matchTechnique(intensityTechnique: string | null): TechniqueCatalogEntry | null {
  if (!intensityTechnique) return null;
  const text = normalize(intensityTechnique);
  return TECHNIQUE_CATALOG.find((t) => text.includes(normalize(t.match))) ?? null;
}

/** Pesos sugeridos de las bajadas de un drop set, a partir del peso de la serie principal, redondeados al incremento del ejercicio. */
export function getDropSetWeightSuggestions(mainWeightKg: number, incrementKg: number): number[] {
  return TECHNIQUE_CONFIG.dropSets.weightPcts.map((pct) => roundToStep(mainWeightKg * pct, incrementKg));
}

/** Arranca una serie vacía (sin datos) del tipo correcto para una técnica, para agregarla a `drops`/`miniSets`. */
export function emptyDrop(): { weightKg: number | null; reps: number | null } {
  return { weightKg: null, reps: null };
}
export function emptyMiniSet(): { reps: number | null } {
  return { reps: null };
}

/**
 * Peso adicional (kg) que aportan los "extras" de una técnica al tonelaje
 * total, sumado aparte del peso×reps de la serie principal (que ya se suma
 * en otro lado) — nunca entra a e1RM/PR/sugerencia/referencia/alertas, solo
 * a tonelaje y al detalle de la sesión. Supuesto (a confirmar): los parciales
 * suman como reps completas al peso principal, y la plancha estática suma
 * una vez el peso sostenido (no tiene "reps").
 */
export function getExtraTonnageKg(set: LoggedSet): number {
  const extra = set.technique;
  if (!extra) return 0;
  switch (extra.kind) {
    case "drop-sets":
      return extra.drops.reduce((sum, d) => sum + (d.weightKg !== null && d.reps !== null ? d.weightKg * d.reps : 0), 0);
    case "partials":
      return set.weightKg !== null && extra.partialReps !== null ? set.weightKg * extra.partialReps : 0;
    case "myo-reps":
      return set.weightKg !== null
        ? extra.miniSets.reduce((sum, m) => sum + (m.reps !== null ? set.weightKg! * m.reps : 0), 0)
        : 0;
    case "static-hold":
      return extra.weightKg ?? 0;
    default:
      return 0;
  }
}

export function emptyTechniqueExtra(kind: TechniqueCatalogEntry["kind"]): TechniqueExtra {
  switch (kind) {
    case "drop-sets":
      return { kind, drops: [emptyDrop(), emptyDrop()] };
    case "partials":
      return { kind, partialReps: null };
    case "myo-reps":
      return { kind, miniSets: [] };
    case "static-hold":
      return { kind, weightKg: null, seconds: null };
  }
}
