"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X } from "lucide-react";

interface TipoDocumento {
  id: string;
  prefijo: string;
  nombre: string;
  aplica_a: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  sectorId: string;
  sectorAbreviatura?: string | null;
  usuarios: Array<{ id: string; nombre: string }>;
}

export function InstructivoFormDialog({ open, onOpenChange, onSuccess, sectorId, sectorAbreviatura, usuarios }: Props) {
  const [nombre, setNombre] = useState("");
  const [responsableId, setResponsableId] = useState("__none__");
  const [esPublico, setEsPublico] = useState(false);
  const [tipoDocId, setTipoDocId] = useState("__none__");
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; nombre: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/procesos/tipos-documento?aplica_a=instructivo")
      .then((r) => r.json())
      .then((d) => setTipos(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (open) {
      setNombre("");
      setResponsableId("__none__");
      setEsPublico(false);
      setTipoDocId("__none__");
      setUploadedFile(null);
    }
  }, [open]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/procesos/instructivos/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setUploadedFile({ url: data.url, nombre: data.nombre_archivo ?? file.name });
    e.target.value = "";
    setUploading(false);
  }

  const selectedTipo = tipos.find((t) => t.id === tipoDocId);
  const codigoPreview = selectedTipo && sectorAbreviatura
    ? `${selectedTipo.prefijo}-${sectorAbreviatura}-??`
    : null;

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/procesos/instructivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector_id: sectorId,
          nombre: nombre.trim(),
          responsable_id: responsableId === "__none__" ? null : responsableId,
          es_publico: esPublico,
          url_archivo: uploadedFile?.url ?? null,
          nombre_archivo: uploadedFile?.nombre ?? null,
          tipo_doc_id: tipoDocId === "__none__" ? null : tipoDocId,
          estado: "borrador",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo instructivo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">Nombre *</label>
            <Input
              className="mt-1"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Instructivo de recepción"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Responsable</label>
            <Select value={responsableId} onValueChange={setResponsableId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sin responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin responsable</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tipos.length > 0 && (
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
                <p className="text-xs text-amber-600 mt-1">Sector sin abreviatura. El código se generará cuando se configure.</p>
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Archivo (opcional)</label>
            <div className="mt-1 flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
                {uploading ? "Subiendo..." : "Seleccionar archivo"}
              </Button>
              {uploadedFile && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-green-600 truncate max-w-[140px]">{uploadedFile.nombre}</span>
                  <button onClick={() => setUploadedFile(null)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="es_publico"
              checked={esPublico}
              onChange={(e) => setEsPublico(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="es_publico" className="text-sm cursor-pointer">
              Instructivo público
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nombre.trim() || uploading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
