import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  hint?: string;
}

/** Mensaje amigable para secciones sin datos todavía, en vez de dejarlas vacías o con una sola línea de texto suelta. */
export function EmptyState({ icon, title, hint }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-block border border-dashed border-border px-4 py-8 text-center">
      <div className="text-faint">{icon}</div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted">{hint}</p>}
    </div>
  );
}
