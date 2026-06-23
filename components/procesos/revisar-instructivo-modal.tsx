"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload } from "lucide-react";

interface Instructivo {
  id: string;
  nombre: string;
  version: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  instructivo: Instructivo;
}

export function RevisarInstructivoModal({ open, onOpenChange, onSuccess, instructivo }: Props) {
  const [huboCambio, setHuboCambio] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; nombre: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("instructivo_id", instructivo.id);
    const res = await fetch("/api/procesos/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setUploadedFile({ url: data.url, nombre: data.nombre });
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/procesos/instructivos/${instructivo.id}/revisar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hubo_cambio: huboCambio,
          observaciones: observaciones.trim() || null,
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

  function handleClose() {
    setHuboCambio(false);
    setObservaciones("");
    setUploadedFile(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Revisar instructivo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            <strong>{instructivo.nombre}</strong> — v{instructivo.version}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setHuboCambio(false)}
              className={`border-2 rounded-lg p-3 text-sm font-medium transition-colors ${
                !huboCambio
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-muted hover:border-muted-foreground/30"
              }`}
            >
              Sin cambios
            </button>
            <button
              type="button"
              onClick={() => setHuboCambio(true)}
              className={`border-2 rounded-lg p-3 text-sm font-medium transition-colors ${
                huboCambio
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-muted hover:border-muted-foreground/30"
              }`}
            >
              Hay cambios
            </button>
          </div>

          {huboCambio && (
            <div>
              <label className="text-sm font-medium">Nuevo archivo</label>
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
                  <span className="text-xs text-green-600 truncate max-w-[150px]">{uploadedFile.nombre}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Se creará una nueva versión pendiente de aprobación.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Observaciones</label>
            <textarea
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas sobre la revisión..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar revisión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
