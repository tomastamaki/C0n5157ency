import { useState } from "react";
import type { HabitColor } from "../../types/habits";
import { IconCheck, IconFlame, IconInfo, IconLink, IconPlay, IconRotateCcw, IconShield } from "../icons";
import { HeatRow } from "./HeatRow";
import { Streak } from "./Streak";
import { habitIconFor, HABIT_COLORS } from "./habitVisuals";
import type { HeatCellLike } from "./HeatGrid";
import { CardActionMenu } from "./CardActionMenu";
import { ExactValueField } from "./ExactValueField";
import { useLongPress } from "../../lib/useLongPress";

export type HabitCardStatus = "pending" | "done" | "skip";

interface HabitCardCommon {
  id: string;
  name: string;
  icon: string;
  color: HabitColor;
  status: HabitCardStatus;
  streak: number;
  streakUnit?: string;
  subtitle: string;
  heat: HeatCellLike[];
  auto?: boolean;
  /** La última ocurrencia pasada quedó sin registrar: aviso de recuperación. */
  recovery?: boolean;
  onUnskip?: () => void;
  /** Tocar el nombre/ícono (no el control de acción) abre el detalle del hábito. */
  onOpenDetail?: () => void;
  /** Mantener presionado abre el menú rápido (editar, cantidad exacta, ver detalle). */
  onEdit?: () => void;
  /** Progreso de la semana en curso, para hábitos de meta semanal (sin día asignado). */
  weekly?: { done: number; n: number; atRisk: boolean };
}

interface YesNoCard extends HabitCardCommon {
  kind: "yesno";
  onToggle?: () => void;
}

interface QuantityCard extends HabitCardCommon {
  kind: "quantity";
  current: number;
  goal: number;
  unit: string;
  quickAmounts?: number[];
  onAdd?: (amount: number) => void;
  /** Campo de valor exacto, siempre disponible además de los botones rápidos. */
  onAddExact?: (amount: number) => void;
  /** "Deshacer el último registro" — solo se muestra si hay al menos uno hoy. */
  onUndoLast?: () => void;
  hasLogsToday?: boolean;
}

interface TimeCard extends HabitCardCommon {
  kind: "time";
  goalMinutes: number;
  running?: boolean;
  elapsedLabel?: string;
  onStart?: () => void;
  onFinish?: () => void;
}

interface AvoidCard extends HabitCardCommon {
  kind: "avoid";
  onToggle?: () => void;
}

export type HabitCardProps = YesNoCard | QuantityCard | TimeCard | AvoidCard;

function formatQuantity(current: number, goal: number, unit: string): string {
  if (unit === "ml") return `${(current / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} / ${(goal / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} L`;
  const u = unit === "pasos" ? "" : ` ${unit}`;
  return `${current.toLocaleString("es-AR")} / ${goal.toLocaleString("es-AR")}${u}`.trim();
}

/**
 * Progreso de la semana en curso para hábitos de meta semanal: segmentos +
 * "N/M esta semana", y aviso ámbar si ya no alcanzan los días que quedan.
 * `tone="onColor"` para la tarjeta "hecho" (ya rellena del color del hábito,
 * donde un segmento del mismo color quedaría invisible — mismo criterio que `HeatRow`).
 */
function WeeklyBadge({
  weekly,
  color,
  tone = "default",
}: {
  weekly: NonNullable<HabitCardCommon["weekly"]>;
  color: string;
  tone?: "default" | "onColor";
}) {
  const onColor = tone === "onColor";
  return (
    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {[...Array(weekly.n)].map((_, i) => (
            <i
              key={i}
              className="block h-1.5 w-[22px] rounded-pill"
              style={{ backgroundColor: i < weekly.done ? color : onColor ? "rgba(13,14,19,0.16)" : "rgb(var(--surface-2))" }}
            />
          ))}
        </div>
        <span className={`text-xs ${onColor ? "text-habitink/80" : "text-muted"}`}>
          {weekly.done}/{weekly.n} esta semana
        </span>
      </div>
      {weekly.atRisk && (
        // Fondo sólido + texto habitink (no el tinte suave con texto color warning): ese combo no
        // llegaba a 4.5:1 en tema claro (2.40:1, medido en la revisión de Fase 7).
        <span
          className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-bold ${
            onColor ? "bg-habitink/[0.16] text-habitink" : "bg-warning text-habitink"
          }`}
        >
          <IconInfo className="h-3 w-3" />
          En riesgo
        </span>
      )}
    </div>
  );
}

function RecoveryBanner({ streak }: { streak: number }) {
  // Texto en `text-ink` (no `text-warning`): sobre el tinte suave bg-warning/15, el texto color
  // warning no llegaba a 4.5:1 en tema claro (2.40:1, medido en la revisión de Fase 7). El ícono
  // sigue en warning como acento de color — no necesita el mismo piso de contraste que el texto.
  return (
    <div className="mt-3 flex items-center gap-2 rounded-block bg-warning/15 px-2.5 py-2 text-xs leading-snug text-ink">
      <IconShield className="h-3.5 w-3.5 shrink-0 text-warning" />
      <span>
        <b className="font-bold">No dos seguidas.</b> Hoy sostiene tu racha de {streak} días.
      </span>
    </div>
  );
}

export function HabitCard(props: HabitCardProps) {
  const color = HABIT_COLORS[props.color];
  const Icon = habitIconFor(props.icon);

  const [menuOpen, setMenuOpen] = useState(false);
  const canOpenMenu = Boolean(props.onEdit) || Boolean(props.onOpenDetail) || (props.kind === "quantity" && Boolean(props.onAddExact));
  const press = useLongPress(props.onOpenDetail, canOpenMenu ? () => setMenuOpen(true) : undefined);
  const menu = menuOpen && canOpenMenu && (
    <CardActionMenu
      title={props.name}
      color={color}
      unit={props.kind === "quantity" ? props.unit : undefined}
      onClose={() => setMenuOpen(false)}
      onEdit={props.onEdit}
      onAddExact={props.kind === "quantity" ? props.onAddExact : undefined}
      onOpenDetail={props.onOpenDetail}
    />
  );

  if (props.status === "done") {
    return (
      <>
        <div
          className="rounded-card px-3.5 py-3 text-habitink shadow-elevated"
          style={{ backgroundColor: color }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-block bg-habitink/[0.14]">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1" role={props.onOpenDetail ? "button" : undefined} {...press}>
              <div className="flex items-center gap-1.5 text-[15px] font-bold">
                {props.name}
                {props.auto && (
                  <span className="rounded-pill bg-habitink/[0.16] px-2 py-0.5 text-[11px] font-bold">Auto</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2.5 text-habitink/80">
                <span className="inline-flex items-center gap-1 text-xs font-semibold">
                  <IconFlame className="h-3.5 w-3.5" />
                  <b className="font-mono">{props.streak}</b> {props.streakUnit ?? "días"}
                </span>
                <HeatRow cells={props.heat.slice(0, -1).concat({ pct: 100, label: "hoy: hecho" })} tone="onColor" />
              </div>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-habitink text-success">
              <IconCheck className="h-4 w-4" strokeWidth={3} />
            </span>
          </div>
          {props.weekly && <WeeklyBadge weekly={props.weekly} color="#0d0e13" tone="onColor" />}
        </div>
        {menu}
      </>
    );
  }

  if (props.status === "skip") {
    return (
      <>
        <div className="rounded-card border border-dashed border-border px-3.5 py-3 opacity-[0.62]">
          <div className="flex items-center gap-3">
            <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-block bg-ghost text-muted">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1" role={props.onOpenDetail ? "button" : undefined} {...press}>
              <div className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
                {props.name}
                <span className="rounded-pill bg-surface2 px-2 py-0.5 text-[11px] font-bold text-muted">salteado</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                Sin drama: tu racha de {props.streak} {props.streakUnit ?? "días"} sigue en pie
              </div>
            </div>
            <button type="button" onClick={props.onUnskip} className="shrink-0 text-xs font-bold text-primary">
              Deshacer
            </button>
          </div>
        </div>
        {menu}
      </>
    );
  }

  return (
    <>
    <div
      className="rounded-card border bg-surface px-3.5 py-3.5 shadow-elevated"
      style={{ borderColor: `color-mix(in srgb, ${color} 30%, rgb(var(--border)))` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-block text-habitink"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1" role={props.onOpenDetail ? "button" : undefined} {...press}>
          <div className="text-[15px] font-bold text-ink">{props.name}</div>
          <div className="mt-0.5 text-xs text-muted">
            {props.recovery ? "Ayer quedó afuera · hoy es el día" : props.subtitle}
          </div>
        </div>
        {props.kind === "yesno" && (
          <button
            type="button"
            aria-label={`Completar ${props.name}`}
            onClick={props.onToggle}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border-2"
            style={{ borderColor: `color-mix(in srgb, ${color} 75%, rgb(var(--border)))`, color }}
          >
            <IconCheck className="h-[22px] w-[22px]" strokeWidth={2.4} />
          </button>
        )}
      </div>

      {props.recovery && <RecoveryBanner streak={props.streak} />}
      {props.weekly && <WeeklyBadge weekly={props.weekly} color={color} />}

      {props.kind === "quantity" && (
        <div className="mt-3">
          <div className="h-2.5 overflow-hidden rounded-pill bg-surface2">
            <div
              className="h-full rounded-pill transition-[width] duration-500"
              style={{ width: `${Math.min(100, (props.current / props.goal) * 100)}%`, backgroundColor: color }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-bold text-ink">
              {formatQuantity(props.current, props.goal, props.unit)}
              <small className="ml-1 text-[11px] font-semibold text-muted">
                {Math.round((props.current / props.goal) * 100)}%
              </small>
            </span>
            {props.auto && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
                <IconLink className="h-3 w-3" />
                Se completa solo
              </span>
            )}
          </div>

          {!props.auto && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {(props.quickAmounts ?? []).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => props.onAdd?.(n)}
                  className="tap-target h-9 rounded-pill border px-3 font-mono text-[13px] font-bold text-ink"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${color} 20%, rgb(var(--surface)))`,
                    borderColor: `color-mix(in srgb, ${color} 50%, rgb(var(--border)))`,
                  }}
                >
                  +{n} {props.unit}
                </button>
              ))}
              {props.onAddExact && <ExactValueField unit={props.unit} color={color} onAdd={props.onAddExact} />}
              {props.hasLogsToday && props.onUndoLast && (
                <button type="button" onClick={props.onUndoLast} className="ml-auto flex items-center gap-1 text-xs font-bold text-primary">
                  <IconRotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Deshacer último
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {props.kind === "time" && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {props.running ? (
            <div>
              <div className="flex items-center font-mono text-3xl font-extrabold tracking-wide text-ink">
                <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: color }} />
                {props.elapsedLabel ?? "00:00"}
              </div>
              <div className="mt-0.5 text-xs text-muted">de {props.goalMinutes} min · en curso</div>
            </div>
          ) : (
            <div className="text-xs text-muted">{props.goalMinutes} min</div>
          )}
          <button
            type="button"
            onClick={props.running ? props.onFinish : props.onStart}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-3 font-mono text-[13px] font-bold text-habitink"
            style={{ backgroundColor: color }}
          >
            {props.running ? (
              <>
                <IconCheck className="h-3.5 w-3.5" strokeWidth={2.6} />
                Listo
              </>
            ) : (
              <>
                <IconPlay className="h-3.5 w-3.5" strokeWidth={2.2} />
                Iniciar {props.goalMinutes} min
              </>
            )}
          </button>
        </div>
      )}

      {props.kind === "avoid" && (
        <button
          type="button"
          onClick={props.onToggle}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border text-sm font-bold text-ink"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 20%, rgb(var(--surface)))`,
            borderColor: `color-mix(in srgb, ${color} 50%, rgb(var(--border)))`,
          }}
        >
          <IconShield className="h-[18px] w-[18px]" />
          Hoy lo evité
        </button>
      )}

      <div className="mt-3 flex items-center justify-between">
        <HeatRow cells={props.heat} />
        <Streak streak={props.streak} unit={props.streakUnit} />
      </div>
    </div>
    {menu}
    </>
  );
}
