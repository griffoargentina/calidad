"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  item: { id: string; codigo: string; titulo: string };
}

export function SubirProcedimientoModal({ item }: Props) {
  const router = useRouter();
  const supabase = createClient();
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

  async function handleSubir() {
    if (!file) { setError("Seleccioná un archivo."); return; }
    setLoading(true);
    setError(null);

    try {
      const ext = file.name.split(".").pop();
      const path = `items/${item.id}/procedimiento_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);

      const { error: insertError } = await supabase.from("archivos").insert({
        item_id: item.id,
        version: 1,
        archivo_url: publicUrl,
        nombre_archivo: file.name,
        tamaño_bytes: file.size,
        comentario: comentario || null,
        categoria: "procedimiento",
      });

      if (insertError) throw new Error(insertError.message);

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
