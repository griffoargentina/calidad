"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface Sector {
  id: string;
  nombre: string;
  descripcion: string | null;
  privado: boolean;
  responsables?: Array<{ id: string; nombre: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  sector?: Sector | null;
  usuarios: Array<{ id: string; nombre: string }>;
}

export function SectorFormDialog({ open, onOpenChange, onSuccess, sector, usuarios }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [privado, setPrivado] = useState(false);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre(sector?.nombre ?? "");
      setDescripcion(sector?.descripcion ?? "");
      setPrivado(sector?.privado ?? false);
      setResponsables(sector?.responsables?.map((r) => r.id) ?? []);
    }
  }, [open, sector]);

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const url = sector ? `/api/procesos/sectores/${sector.id}` : "/api/procesos/sectores";
      const method = sector ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          privado,
          responsables,
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

  function toggleResponsable(id: string) {
    setResponsables((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{sector ? "Editar sector" : "Nuevo sector"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">Nombre *</label>
            <Input
              className="mt-1"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Logística"
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
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="privado"
              checked={privado}
              onChange={(e) => setPrivado(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="privado" className="text-sm font-medium cursor-pointer">
              Sector privado (solo visible para admin y responsables)
            </label>
          </div>
          {usuarios.length > 0 && (
            <div>
              <label className="text-sm font-medium">Responsables</label>
              <div className="mt-1 border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
                {usuarios.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={responsables.includes(u.id)}
                      onChange={() => toggleResponsable(u.id)}
                    />
                    {u.nombre}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nombre.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
