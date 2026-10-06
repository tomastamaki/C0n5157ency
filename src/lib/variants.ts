import type { AppSettings } from "./storage";

/** La variante predeterminada actual de un ejercicio prescripto (o el original mismo si nunca se cambió). */
export function getDefaultVariant(settings: AppSettings, originalExerciseName: string): string {
  return settings.exerciseVariantDefaults[originalExerciseName] ?? originalExerciseName;
}

/**
 * Patch de `exerciseVariantDefaults` para elegir `name` como variante de
 * `originalExerciseName` (o volver al original si `name` es null/igual al
 * original, lo que borra la entrada en vez de guardar una redundante).
 */
export function withVariantChoice(
  settings: AppSettings,
  originalExerciseName: string,
  name: string | null
): Record<string, string> {
  const next = { ...settings.exerciseVariantDefaults };
  if (name === null || name === originalExerciseName) delete next[originalExerciseName];
  else next[originalExerciseName] = name;
  return next;
}
