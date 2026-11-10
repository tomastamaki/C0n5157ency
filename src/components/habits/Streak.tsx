import { IconFlame } from "../icons";

interface StreakProps {
  streak: number;
  unit?: string;
  /** Tarjeta/mosaico ya está sobre el color del hábito: atenuar al tono de la tinta. */
  dim?: boolean;
}

/** "🔥 N días" — racha de un hábito. */
export function Streak({ streak, unit, dim }: StreakProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${dim ? "text-habitink/80" : "text-muted"}`}>
      <IconFlame className={`h-3.5 w-3.5 ${dim ? "" : "text-warning"}`} />
      <b className="font-mono">{streak}</b> {unit ?? "días"}
    </span>
  );
}
