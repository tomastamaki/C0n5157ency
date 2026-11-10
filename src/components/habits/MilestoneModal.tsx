import { HABITS_CONFIG } from "../../lib/habitsConfig";
import { Ring } from "./Ring";
import { IconCheck, IconFlame } from "../icons";

interface Props {
  habitName: string;
  milestone: number;
  color: string;
  onContinue: () => void;
  onViewDetail: () => void;
}

/** Tarjeta de celebración al cruzar 7/30/100 días de racha. Una sola vez por hito, sin confeti. */
export function MilestoneModal({ habitName, milestone, color, onContinue, onViewDetail }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6" style={{ backgroundColor: "rgba(5,6,9,0.66)" }}>
      <div className="w-full max-w-sm rounded-card border border-border bg-surface px-6 py-6 text-center shadow-elevated">
        <div className="mx-auto w-fit">
          <Ring
            size={104}
            strokeWidth={9}
            pct={1}
            color={color}
            centerLabel={<IconFlame className="h-9 w-9" style={{ color: "rgb(var(--warning))" }} strokeWidth={1.8} />}
          />
        </div>
        <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">¡Vamos toro!</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          <b className="font-mono text-ink">{milestone} días</b> seguidos con {habitName}.
          <br />
          Eso ya es un hábito de verdad.
        </p>
        <div className="my-4 flex justify-center gap-2">
          {HABITS_CONFIG.milestones.map((m) => (
            <span
              key={m}
              className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11.5px] font-bold ${
                m <= milestone ? "bg-success/15 text-success" : "bg-surface2 text-muted"
              }`}
            >
              {m <= milestone && <IconCheck className="h-3 w-3" strokeWidth={3} />}
              {m}
            </span>
          ))}
        </div>
        <button type="button" onClick={onContinue} className="w-full rounded-pill bg-primary py-3 text-sm font-semibold text-white">
          Seguir
        </button>
        <button type="button" onClick={onViewDetail} className="mt-1 w-full rounded-pill py-2.5 text-sm font-semibold text-primary">
          Ver detalle
        </button>
      </div>
    </div>
  );
}
