import { useEffect, useState } from "react";

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  allowDecimal?: boolean;
  className?: string;
}

/**
 * Input numérico que evita el bug de iOS donde `type="number"` (incluso con
 * `inputMode="decimal"`) a veces muestra un teclado sin separador decimal.
 * Usa `type="text"` + `inputMode`/`pattern` para forzar el teclado correcto
 * en todos los dispositivos, y acepta tanto "." como "," como separador.
 */
export function NumericInput({ value, onChange, allowDecimal = true, className }: Props) {
  const [text, setText] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setText(value === null ? "" : String(value));
  }, [value]);

  function handleChange(raw: string) {
    const normalized = allowDecimal ? raw.replace(",", ".") : raw;
    const valid = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
    if (!valid.test(normalized)) return;

    setText(normalized);

    if (normalized === "" || normalized === ".") {
      onChange(null);
      return;
    }
    const num = Number(normalized);
    if (!Number.isNaN(num)) onChange(num);
  }

  return (
    <input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      pattern={allowDecimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      className={className}
    />
  );
}
