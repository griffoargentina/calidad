"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Loader2 } from "lucide-react";

interface Props {
  clausulaId: string;
  titulo: string;
  descripcion: string | null;
}

export function EditClausulaButton({ clausulaId, titulo, descripcion }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tituloVal, setTituloVal] = useState(titulo);
  const [descVal, setDescVal] = useState(descripcion ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!tituloVal.trim()) return;
    setSaving(true);
    await fetch(`/api/admin/clausulas/${clausulaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: tituloVal.trim(),
        descripcion: descVal.trim() || null,
      }),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 mr-1.5" />
        Editar punto
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cláusula {clausulaId}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Título</label>
              <Input
                value={tituloVal}
                onChange={e => setTituloVal(e.target.value)}
                placeholder="Título de la cláusula"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Descripción / ayuda
              </label>
              <Textarea
                value={descVal}
                onChange={e => setDescVal(e.target.value)}
                placeholder="Explicá qué tipo de evidencia se sube en esta sección..."
                rows={4}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Visible como guía para los usuarios al cargar documentos.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !tituloVal.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
