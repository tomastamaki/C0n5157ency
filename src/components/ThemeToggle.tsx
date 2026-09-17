import { useApp } from "../context/AppContext";
import { IconMoon, IconSun } from "./icons";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { settings, updateSettings } = useApp();
  const isDark = settings.theme === "dark";
  const Icon = isDark ? IconMoon : IconSun;

  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: isDark ? "light" : "dark" })}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      aria-pressed={isDark}
      title={isDark ? "Tema oscuro" : "Tema claro"}
      className={
        compact
          ? "flex h-9 w-9 items-center justify-center rounded-pill border border-accent/35 bg-accent/8 text-accent transition-transform hover:bg-accent/14 active:scale-95"
          : "flex items-center gap-2 rounded-pill border border-accent/35 bg-accent/8 px-3 py-2 text-sm font-medium text-muted transition-transform hover:bg-accent/14 active:scale-95"
      }
    >
      <Icon className="h-[18px] w-[18px] text-accent" />
      {!compact && <span>{isDark ? "Oscuro" : "Claro"}</span>}
    </button>
  );
}
