"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface Instructivo {
  id: string;
  nombre: string;
  version: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  instructivo: Instructivo;
}

export function AprobarInstructivoModal({ open, onOpenChange, onSuccess, instructivo }: Props) {
  const [decision, setDecision] = useState<"aprobar" | "rechazar" | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!decision) return;
    if (decision === "rechazar" && !observaciones.trim()) {
      alert("Las observaciones son requeridas al rechazar.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/procesos/instructivos/${instructivo.id}/aprobar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aprobar: decision === "aprobar",
          observaciones: observaciones.trim() || null,
        }),
      });
      if (res.ok) {
        onOpenChange(false);
        onSuccess();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setDecision(null);
    setObservaciones("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aprobación de instructivo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            <strong>{instructivo.nombre}</strong> — v{instructivo.version}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDecision("aprobar")}
              className={`border-2 rounded-lg p-3 flex flex-col items-center gap-2 text-sm font-medium transition-colors ${
                decision === "aprobar"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-muted hover:border-green-200"
              }`}
            >
              <CheckCircle2 className="h-5 w-5" />
              Aprobar
            </button>
            <button
              type="button"
              onClick={() => setDecision("rechazar")}
              className={`border-2 rounded-lg p-3 flex flex-col items-center gap-2 text-sm font-medium transition-colors ${
                decision === "rechazar"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-muted hover:border-red-200"
              }`}
            >
              <XCircle className="h-5 w-5" />
              Rechazar
            </button>
          </div>

          <div>
            <label className="text-sm font-medium">
              Observaciones{decision === "rechazar" ? " *" : " (opcional)"}
            </label>
            <textarea
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-1 focus:ring-ring"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder={
                decision === "rechazar"
                  ? "Motivo del rechazo (requerido)..."
                  : "Comentarios de aprobación (opcional)..."
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !decision || (decision === "rechazar" && !observaciones.trim())}
            className={decision === "rechazar" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : decision === "rechazar" ? "Rechazar" : "Aprobar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
