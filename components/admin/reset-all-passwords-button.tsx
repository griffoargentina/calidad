"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

export function ResetAllPasswordsButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleReset() {
    if (!confirm("¿Resetear la contraseña de TODOS los usuarios a 123456?")) return;
    setLoading(true);
    const res = await fetch("/api/admin/reset-all-passwords", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setDone(true);
      alert(`Contraseñas reseteadas: ${data.total} usuarios`);
    } else {
      alert("Error: " + data.error);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReset}
      disabled={loading || done}
      className="text-orange-600 border-orange-200 hover:bg-orange-50"
    >
      {loading
        ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Reseteando...</>
        : <><RefreshCw className="mr-1.5 h-4 w-4" />{done ? "Hecho" : "Reset all → 123456"}</>
      }
    </Button>
  );
}
