import { useApp } from "../context/AppContext";

export function Watermark() {
  const { settings } = useApp();
  const isDark = settings.theme === "dark";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <span
        className="absolute -right-6 -top-10 select-none font-mono font-bold leading-none text-accent"
        style={{
          fontSize: "min(46vw, 380px)",
          opacity: isDark ? 0.16 : 0.08,
          mixBlendMode: isDark ? "screen" : "multiply",
        }}
      >
        7
      </span>
    </div>
  );
}
