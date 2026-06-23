"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";

const TIPO_DOCUMENTO_OPTIONS = [
  { value: "MA", label: "MA — Manual" },
  { value: "PR", label: "PR — Procedimiento" },
  { value: "IT", label: "IT — Instructivo de Trabajo" },
  { value: "FO", label: "FO — Formato / Formulario" },
  { value: "RE", label: "RE — Registro" },
  { value: "DS", label: "DS — Documento de Soporte" },
];

interface Props {
  item: { id: string; codigo: string; titulo: string };
}

export function SubirProcedimientoModal({ item }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [comentario, setComentario] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [codigoPreview, setCodigoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!tipoDocumento) { setCodigoPreview(null); return; }
    fetch(`/api/items/preview-codigo?prefijo=${tipoDocumento}`)
      .then((r) => r.json())
      .then((d) => { if (d.codigo) setCodigoPreview(d.codigo); });
  }, [tipoDocumento]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  async function handleSubir() {
    if (!file) { setError("Seleccioná un archivo."); return; }
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("item_id", item.id);
      fd.append("categoria", "procedimiento");
      fd.append("version", "1");
      if (comentario) fd.append("comentario", comentario);
      if (tipoDocumento) fd.append("tipo_documento", tipoDocumento);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir");

      // Actualizar proc_fecha_vencimiento = hoy + 365 días
      const procVenc = new Date();
      procVenc.setDate(procVenc.getDate() + 365);
      const procVencStr = procVenc.toISOString().slice(0, 10);
      await fetch(`/api/items/${item.id}/quick-edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proc_fecha_vencimiento: procVencStr }),
      });

      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setFile(null);
        setComentario("");
        setTipoDocumento("");
        setCodigoPreview(null);
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BookOpen className="h-4 w-4 mr-1.5" />
        Subir procedimiento
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subir procedimiento</DialogTitle>
            <DialogDescription>
              <span className="font-mono font-semibold">{item.codigo}</span> — {item.titulo}
              <br />
              Subí el documento de procedimiento asociado a este item.
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="flex flex-col items-center py-8 gap-2 text-green-600">
              <CheckCircle2 className="h-12 w-12" />
              <p className="font-semibold">Procedimiento cargado</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo (opcional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_DOCUMENTO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {codigoPreview && (
                  <p className="text-xs text-muted-foreground">
                    Código asignado: <span className="font-mono font-semibold text-blue-600">{codigoPreview}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Archivo <span className="text-destructive">*</span></Label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <FileText className="h-5 w-5" />
                      <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Cliqueá para seleccionar archivo</p>
                      <p className="text-xs mt-1">PDF, Excel, Word</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.xlsx,.xls,.doc,.docx"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Comentario (opcional)</Label>
                <Textarea
                  placeholder="Ej: Procedimiento actualizado según revisión interna..."
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={2}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
              )}
            </div>
          )}

          {!done && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
              <Button onClick={handleSubir} disabled={loading || !file}>
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Subiendo...</>
                  : <><BookOpen className="mr-2 h-4 w-4" />Subir procedimiento</>
                }
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
