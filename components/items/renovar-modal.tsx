"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";

interface RenovarModalProps {
  item: {
    id: string;
    codigo: string;
    titulo: string;
    version_actual: number;
    requiere_aprobacion: boolean;
  };
}

export function RenovarModal({ item }: RenovarModalProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  async function handleRenovar() {
    if (!file) {
      setError("Seleccioná un archivo antes de renovar.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("item_id", item.id);
      fd.append("version", String(item.version_actual + 1));
      if (comentario) fd.append("comentario", comentario);

      const res = await fetch("/api/renovar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al renovar");

      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setFile(null);
        setComentario("");
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
      <Button size="sm" onClick={() => setOpen(true)}>
        <RefreshCw className="h-4 w-4 mr-1.5" />
        Renovar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar documento</DialogTitle>
            <DialogDescription>
              <span className="font-mono font-semibold">{item.codigo}</span> — {item.titulo}
              <br />
              Esta acción creará la versión {item.version_actual + 1} y actualizará la fecha de vencimiento.
              {item.requiere_aprobacion && (
                <span className="block mt-1 text-yellow-600 font-medium">
                  Este documento requiere aprobación del administrador antes de quedar vigente.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="flex flex-col items-center py-8 gap-2 text-green-600">
              <CheckCircle2 className="h-12 w-12" />
              <p className="font-semibold">¡Documento renovado!</p>
              <p className="text-sm text-muted-foreground">v{item.version_actual + 1} generada correctamente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selector de archivo */}
              <div className="space-y-2">
                <Label>Nuevo archivo <span className="text-destructive">*</span></Label>
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
                      <p className="text-xs mt-1">PDF, Excel, Word, imágenes</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
                  />
                </div>
              </div>

              {/* Comentario */}
              <div className="space-y-2">
                <Label>Comentario (opcional)</Label>
                <Textarea
                  placeholder="Ej: Se actualizó procedimiento según nueva normativa..."
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
              )}
            </div>
          )}

          {!done && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleRenovar} disabled={loading || !file}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Renovando...</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" />Renovar v{item.version_actual + 1}</>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
