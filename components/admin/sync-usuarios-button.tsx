"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SyncUsuariosButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/admin/seed-usuarios", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setMsg("Error: " + (data.error ?? "desconocido")); return; }
    // Mostrar resultado antes de recargar
    const lineas = Object.entries(data.resultados as Record<string, string>)
      .map(([e, s]) => `${e}: ${s}`)
      .join("\n");
    setMsg(`Total en tabla: ${data.total_en_tabla}\n${lineas}`);
    // No recarga automática — el usuario ve el diagnóstico
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Sincronizando…" : "Sincronizar usuarios"}
      </Button>
      {msg && (
        <pre className="text-xs text-right whitespace-pre-wrap max-w-xs text-muted-foreground border rounded p-2 bg-muted/50">
          {msg}
        </pre>
      )}
    </div>
  );
}
