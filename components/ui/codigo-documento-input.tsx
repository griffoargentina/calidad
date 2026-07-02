"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  prefijo: string | null;
  value: string;           // número como string, ej: "04"
  onChange: (numero: string) => void;
  disabled?: boolean;
}

export function CodigoDocumentoInput({ prefijo, value, onChange, disabled }: Props) {
  const [cargando, setCargando] = useState(false);

  // Cuando cambia el prefijo, sugerir el próximo número
  useEffect(() => {
    if (!prefijo) { onChange(""); return; }
    setCargando(true);
    fetch(`/api/archivos/proximo-codigo?prefijo=${prefijo}`)
      .then(r => r.json())
      .then(d => { onChange(String(d.proximo ?? 1).padStart(2, "0")); })
      .finally(() => setCargando(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefijo]);

  if (!prefijo) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-sm font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 select-none">
        {prefijo}-
      </span>
      {cargando ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          calculando...
        </div>
      ) : (
        <input
          type="number"
          min="1"
          max="9999"
          value={parseInt(value) || ""}
          onChange={e => onChange(String(parseInt(e.target.value) || 1).padStart(2, "0"))}
          disabled={disabled}
          className="w-16 text-center font-mono font-semibold border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
      )}
      {value && !cargando && (
        <span className="text-xs text-muted-foreground">
          → <span className="font-mono font-medium text-slate-700">{prefijo}-{value}</span>
        </span>
      )}
    </div>
  );
}
