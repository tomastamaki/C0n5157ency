import type { ReactNode } from "react";

interface IconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  "aria-label": string;
  variant?: "surface" | "onColor";
}

/** Botón cuadrado de 34px con un solo ícono (volver, editar, mes anterior/siguiente...). */
export function IconButton({ children, onClick, variant = "surface", ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap-target flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill border text-muted active:scale-95 ${
        variant === "onColor"
          ? "border-transparent bg-habitink/[0.14] text-habitink"
          : "border-border bg-surface"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface FabProps {
  children: ReactNode;
  onClick?: () => void;
  "aria-label": string;
  className?: string;
}

/** Botón flotante circular de 56px (crear hábito). */
export function Fab({ children, onClick, className = "", ...rest }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-elevated active:scale-95 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
