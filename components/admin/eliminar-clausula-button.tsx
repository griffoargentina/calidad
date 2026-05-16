"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";

export function EliminarClausulaButton({ clausulaId }: { clausulaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [conflicto, setConflicto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(force = false) {
    if (!confirm(
      force
        ? `¿Confirmar? Se eliminarán la cláusula ${clausulaId} Y todos sus documentos.`
        : `¿Eliminar la cláusula ${clausulaId}?`
    )) return;

    setLoading(true);
    setError(null);
    setConflicto(null);

    const url = force
      ? `/api/admin/clausulas/${clausulaId}?force=true`
      : `/api/admin/clausulas/${clausulaId}`;

    const res = await fetch(url, { method: "DELETE" });
    const data = await res.json();
    setLoading(false);

    if (res.status === 409) {
      setConflicto(data.error);
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Error al eliminar");
      return;
    }

    router.push("/admin/clausulas");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="ghost" size="sm"
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
        onClick={() => handleDelete(false)}
        disabled={loading}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        {loading ? "Eliminando…" : "Eliminar cláusula"}
      </Button>

      {conflicto && (
        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-xs text-yellow-700 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {conflicto}
          </p>
          <Button
            variant="destructive" size="sm"
            onClick={() => handleDelete(true)}
            disabled={loading}
          >
            Eliminar igual con sus documentos
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
