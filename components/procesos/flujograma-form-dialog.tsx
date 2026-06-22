"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface TipoDocumento {
  id: string;
  prefijo: string;
  nombre: string;
  aplica_a: string[];
}

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
  sectorAbreviatura?: string | null;
  flujograma?: Flujograma | null;
}

export function FlujogramaFormDialog({ open, onOpenChange, onSuccess, sectorId, sectorAbreviatura, flujograma }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipoDocId, setTipoDocId] = useState("__none__");
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/procesos/tipos-documento?aplica_a=flujograma")
      .then((r) => r.json())
      .then((d) => setTipos(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (open) {
      setNombre(flujograma?.nombre ?? "");
      setDescripcion(flujograma?.descripcion ?? "");
      setTipoDocId("__none__");
    }
  }, [open, flujograma]);

  const selectedTipo = tipos.find((t) => t.id === tipoDocId);
  const codigoPreview = selectedTipo && sectorAbreviatura
    ? `${selectedTipo.prefijo}-${sectorAbreviatura}-??`
    : null;

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const url = flujograma ? `/api/procesos/flujogramas/${flujograma.id}` : "/api/procesos/flujogramas";
      const method = flujograma ? "PATCH" : "POST";
      const body = flujograma
        ? { nombre: nombre.trim(), descripcion: descripcion.trim() || null }
        : {
            sector_id: sectorId,
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            tipo_doc_id: tipoDocId === "__none__" ? null : tipoDocId,
          };

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
          {!flujograma && tipos.length > 0 && (
            <div>
              <label className="text-sm font-medium">Tipo de documento</label>
              <Select value={tipoDocId} onValueChange={setTipoDocId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin código asignado</SelectItem>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-mono font-medium text-xs mr-2 text-blue-600">{t.prefijo}</span>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {codigoPreview && (
                <p className="text-xs text-muted-foreground mt-1">
                  Código: <span className="font-mono font-semibold text-slate-700">{codigoPreview}</span>
                  <span className="text-muted-foreground/60"> (se asigna al crear)</span>
                </p>
              )}
              {selectedTipo && !sectorAbreviatura && (
                <p className="text-xs text-amber-600 mt-1">
                  El sector no tiene abreviatura configurada. El código se generará cuando se configure.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nombre.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : flujograma ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
