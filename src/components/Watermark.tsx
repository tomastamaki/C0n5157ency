export function Watermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <span
        className="absolute -right-6 -top-10 select-none font-mono font-bold leading-none text-accent"
        style={{ fontSize: "min(46vw, 380px)", opacity: 0.16, mixBlendMode: "screen" }}
      >
        7
      </span>
    </div>
  );
}
