"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  sectorId: string;
  usuarios: Array<{ id: string; nombre: string }>;
}

export function InstructivoFormDialog({ open, onOpenChange, onSuccess, sectorId, usuarios }: Props) {
  const [nombre, setNombre] = useState("");
  const [responsableId, setResponsableId] = useState("__none__");
  const [esPublico, setEsPublico] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; nombre: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setNombre("");
      setResponsableId("__none__");
      setEsPublico(false);
      setUploadedFile(null);
    }
  }, [open]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("instructivo_id", "general");
    const res = await fetch("/api/procesos/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setUploadedFile({ url: data.url, nombre: data.nombre });
    setUploading(false);
  }

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
          <div>
            <label className="text-sm font-medium">Archivo (opcional)</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
                {uploading ? "Subiendo..." : "Seleccionar archivo"}
              </Button>
              {uploadedFile && (
                <span className="text-xs text-green-600 truncate max-w-[160px]">{uploadedFile.nombre}</span>
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
          <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-100 rounded px-3 py-2">
            El instructivo quedará en estado <strong>pendiente de aprobación</strong> hasta que un administrador lo apruebe.
          </p>
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
