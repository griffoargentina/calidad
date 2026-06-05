"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface Flujograma {
  id: string;
  nombre: string;
  descripcion?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  sectorId: string;
  flujograma?: Flujograma | null;
}

export function FlujogramaFormDialog({ open, onOpenChange, onSuccess, sectorId, flujograma }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre(flujograma?.nombre ?? "");
      setDescripcion(flujograma?.descripcion ?? "");
    }
  }, [open, flujograma]);

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const url = flujograma ? `/api/procesos/flujogramas/${flujograma.id}` : "/api/procesos/flujogramas";
      const method = flujograma ? "PATCH" : "POST";
      const body = flujograma
        ? { nombre: nombre.trim(), descripcion: descripcion.trim() || null }
        : { sector_id: sectorId, nombre: nombre.trim(), descripcion: descripcion.trim() || null };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onOpenChange(false);
        onSuccess();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{flujograma ? "Editar flujograma" : "Nuevo flujograma"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium">Nombre *</label>
            <Input
              className="mt-1"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Proceso de compra"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Descripción</label>
            <Input
              className="mt-1"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción breve (opcional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nombre.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
