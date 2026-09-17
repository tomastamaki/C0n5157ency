import { useApp } from "../context/AppContext";
import { IconMoon } from "./icons";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { settings, updateSettings } = useApp();
  const isDark = settings.theme === "dark";

  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: isDark ? "light" : "dark" })}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      aria-pressed={isDark}
      title={isDark ? "Tema oscuro" : "Tema claro"}
      className={
        compact
          ? `flex h-9 w-9 items-center justify-center rounded-pill border text-accent transition-colors ${
              isDark ? "border-accent/35 bg-accent/8" : "border-border"
            }`
          : `flex items-center gap-2 rounded-pill border px-3 py-2 text-sm font-medium text-faint transition-colors ${
              isDark ? "border-accent/35 bg-accent/8" : "border-border"
            }`
      }
    >
      <IconMoon className="h-[18px] w-[18px] text-accent" />
      {!compact && <span>{isDark ? "Oscuro" : "Claro"}</span>}
    </button>
  );
}
