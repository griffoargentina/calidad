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
    if (!res.ok) { setLoading(false); setMsg("Error: " + (data.error ?? "desconocido")); return; }
    window.location.reload();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Sincronizando…" : "Sincronizar usuarios"}
      </Button>
      {msg && <pre className="text-xs text-muted-foreground whitespace-pre-wrap text-right max-w-xs">{msg}</pre>}
    </div>
  );
}
