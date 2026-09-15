import { useApp } from "../context/AppContext";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { settings, updateSettings } = useApp();
  const isDark = settings.theme === "dark";

  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: isDark ? "light" : "dark" })}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={isDark ? "Tema oscuro" : "Tema claro"}
      className={
        compact
          ? "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-base dark:border-slate-700"
          : "flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
      }
    >
      <span aria-hidden>{isDark ? "🌙" : "☀️"}</span>
      {!compact && <span>{isDark ? "Oscuro" : "Claro"}</span>}
    </button>
  );
}
