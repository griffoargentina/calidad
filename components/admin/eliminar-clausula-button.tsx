"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function EliminarClausulaButton({ clausulaId }: { clausulaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`¿Eliminar la cláusula ${clausulaId}? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/clausulas/${clausulaId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error al eliminar");
      setLoading(false);
      return;
    }
    router.push("/admin/clausulas");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50"
        onClick={handleDelete} disabled={loading}>
        <Trash2 className="h-4 w-4 mr-1" />
        {loading ? "Eliminando…" : "Eliminar cláusula"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
