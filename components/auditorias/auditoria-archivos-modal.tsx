"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileCheck, Trash2, ExternalLink, FileText, Clock } from "lucide-react";
import type { Auditoria } from "./auditoria-form-dialog";

interface Archivo {
  id: string;
  nombre: string;
  url: string;
  notas: string | null;
  created_at: string;
  subido_por: { nombre: string } | { nombre: string }[] | null;
}

function getSubidoPor(field: Archivo["subido_por"]): string {
  if (!field) return "";
  const obj = Array.isArray(field) ? field[0] : field;
  return obj?.nombre ?? "";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  auditoria: Auditoria | null;
  canEdit: boolean;
}

export function AuditoriaArchivosModal({ open, onOpenChange, auditoria, canEdit }: Props) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notas, setNotas] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadArchivos = useCallback(async () => {
    if (!auditoria) return;
    setLoading(true);
    const res = await fetch(`/api/auditorias/${auditoria.id}/archivos`);
    const data = await res.json();
    setArchivos(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [auditoria]);

  useEffect(() => {
    if (open && auditoria) {
      loadArchivos();
      setFile(null);
      setNotas("");
      setError(null);
    }
  }, [open, auditoria, loadArchivos]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !auditoria) return;
    setUploading(true);
    setError(null);

    const abortCtrl = new AbortController();
    const { signal } = abortCtrl;

    // Cancel in-flight requests if the modal closes mid-upload
    const cleanup = () => abortCtrl.abort();
    window.addEventListener("beforeunload", cleanup, { once: true });

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("auditoriaId", auditoria.id);
      const uploadRes = await fetch("/api/auditorias/upload", { method: "POST", body: fd, signal });
      if (!uploadRes.ok) {
        const d = await uploadRes.json();
        setError(d.error ?? "Error al subir archivo");
        return;
      }
      const { url, nombre } = await uploadRes.json();

      const saveRes = await fetch(`/api/auditorias/${auditoria.id}/archivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, url, notas }),
        signal,
      });
      if (!saveRes.ok) {
        const d = await saveRes.json();
        setError(d.error ?? "Error al guardar");
        return;
      }

      setFile(null);
      setNotas("");
      loadArchivos();
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("Error al subir archivo");
    } finally {
      window.removeEventListener("beforeunload", cleanup);
      setUploading(false);
    }
  }

  async function handleDelete(archivoId: string) {
    if (!auditoria || !confirm("¿Eliminar este archivo del historial?")) return;
    await fetch(`/api/auditorias/${auditoria.id}/archivos?archivoId=${archivoId}`, { method: "DELETE" });
    loadArchivos();
  }

  function formatFechaHora(iso: string) {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Archivos
          </DialogTitle>
          {auditoria && (
            <p className="text-sm text-muted-foreground">{auditoria.titulo}</p>
          )}
        </DialogHeader>

        {/* Historial */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : archivos.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">No hay archivos subidos todavía</p>
            </div>
          ) : (
            <ul className="divide-y border rounded-lg overflow-hidden">
              {archivos.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
                  <FileCheck className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.nombre}</p>
                    {a.notas && <p className="text-xs text-muted-foreground mt-0.5">{a.notas}</p>}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {formatFechaHora(a.created_at)}
                      {getSubidoPor(a.subido_por) && (
                        <span>· {getSubidoPor(a.subido_por)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={a.url} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver archivo">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                    {canEdit && (
                      <Button size="icon" variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive" title="Eliminar"
                        onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upload form */}
        {canEdit && (
          <form onSubmit={handleUpload} className="border-t pt-4 space-y-3 mt-2">
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center gap-2 justify-center text-sm">
                  <FileCheck className="h-4 w-4 text-green-500" />
                  <span className="truncate max-w-64">{file.name}</span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <Upload className="h-5 w-5 mx-auto mb-1" />
                  Seleccionar archivo
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />

            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Descripción del archivo..." rows={2} />
            </div>

            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

            <Button type="submit" disabled={!file || uploading} className="w-full">
              {uploading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Subiendo...</>
                : <><Upload className="mr-2 h-4 w-4" />Subir archivo</>}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
