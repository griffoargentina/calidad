"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";

interface Instructivo {
  id: string;
  nombre: string;
  version: number;
  tipo_doc_prefijo?: string | null;
}

interface TipoDoc { id: string; prefijo: string; nombre: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  instructivo: Instructivo;
}

export function RevisarInstructivoModal({ open, onOpenChange, onSuccess, instructivo }: Props) {
  const [huboCambio, setHuboCambio] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [tipoDoc, setTipoDoc] = useState("__none__");
  const [tipos, setTipos] = useState<TipoDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/procesos/tipos-documento")
      .then(r => r.json())
      .then(d => setTipos(Array.isArray(d) ? d : []));
  }, []);

  // Pre-select tipo if instructivo already has one
  useEffect(() => {
    if (open && instructivo.tipo_doc_prefijo) {
      setTipoDoc(instructivo.tipo_doc_prefijo);
    }
  }, [open, instructivo.tipo_doc_prefijo]);

  async function handleSave() {
    setSaving(true);
    try {
      let url_archivo: string | null = null;
      let nombre_archivo: string | null = null;

      if (huboCambio && pendingFile) {
        const fd = new FormData();
        fd.append("file", pendingFile);
        fd.append("instructivo_id", instructivo.id);
        if (tipoDoc !== "__none__") fd.append("tipo_documento", tipoDoc);
        const uploadRes = await fetch("/api/procesos/instructivos/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          url_archivo = uploadData.url;
          nombre_archivo = uploadData.nombre_archivo ?? pendingFile.name;
        }
      }

      const res = await fetch(`/api/procesos/instructivos/${instructivo.id}/revisar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hubo_cambio: huboCambio,
          observaciones: observaciones.trim() || null,
          url_archivo,
          nombre_archivo,
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
    setPendingFile(null);
    setTipoDoc("__none__");
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Nuevo archivo</label>
              {tipos.length > 0 && (
                <Select value={tipoDoc} onValueChange={setTipoDoc}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Tipo de documento..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin código asignado</SelectItem>
                    {tipos.map(t => (
                      <SelectItem key={t.id} value={t.prefijo}>
                        <span className="font-mono font-medium text-xs mr-2 text-blue-600">{t.prefijo}</span>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  className="hidden"
                  onChange={e => { setPendingFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1.5" />
                  Seleccionar archivo
                </Button>
                {pendingFile && (
                  <span className="text-xs text-green-600 truncate max-w-[150px]">{pendingFile.name}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar revisión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
