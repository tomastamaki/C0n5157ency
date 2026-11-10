import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

/** Fila de formulario: etiqueta en mayúsculas + pista opcional a la derecha, y el control debajo. */
export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-bold text-muted">
        <span>{label}</span>
        {hint && <span className="font-medium text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Caja de texto estándar del formulario de hábitos (46px, radio 10). */
export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-[46px] w-full rounded-pill border border-border bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/25 ${
        props.className ?? ""
      }`}
    />
  );
}

/** Área de texto estándar del formulario de hábitos ("por qué lo hago"). */
export function TextAreaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[76px] w-full resize-none rounded-pill border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/25 ${
        props.className ?? ""
      }`}
    />
  );
}
