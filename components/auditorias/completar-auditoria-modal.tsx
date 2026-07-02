"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileCheck, RefreshCw } from "lucide-react";
import { CodigoDocumentoInput } from "@/components/ui/codigo-documento-input";
import type { Auditoria } from "./auditoria-form-dialog";

interface TipoDoc { id: string; prefijo: string; nombre: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  auditoria: Auditoria | null;
}

export function CompletarAuditoriaModal({ open, onOpenChange, onSuccess, auditoria }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ncMayores, setNcMayores] = useState("0");
  const [ncMenores, setNcMenores] = useState("0");
  const [observaciones, setObservaciones] = useState("0");
  const [notas, setNotas] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tipoDoc, setTipoDoc] = useState("__none__");
  const [codigoNum, setCodigoNum] = useState("");
  const [tipos, setTipos] = useState<TipoDoc[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/procesos/tipos-documento")
      .then(r => r.json())
      .then(d => setTipos(Array.isArray(d) ? d : []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auditoria) return;
    setLoading(true);
    setError(null);

    let archivo_url: string | null = null;
    let archivo_nombre: string | null = null;

    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("auditoriaId", auditoria.id);
      const prefijo = tipoDoc !== "__none__" ? tipoDoc : null;
      if (prefijo) {
        fd.append("tipo_documento", prefijo);
        if (codigoNum) fd.append("codigo_manual", `${prefijo}-${codigoNum}`);
      }
      const uploadRes = await fetch("/api/auditorias/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        const d = await uploadRes.json();
        setError(d.error ?? "Error al subir archivo");
        setLoading(false);
        return;
      }
      const uploadData = await uploadRes.json();
      archivo_url = uploadData.url;
      archivo_nombre = uploadData.nombre;
    }

    const res = await fetch(`/api/auditorias/${auditoria.id}/completar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nc_mayores: parseInt(ncMayores) || 0,
        nc_menores: parseInt(ncMenores) || 0,
        observaciones_count: parseInt(observaciones) || 0,
        archivo_url,
        archivo_nombre,
        notas,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Error al completar"); return; }

    setNcMayores("0"); setNcMenores("0"); setObservaciones("0");
    setNotas(""); setFile(null); setTipoDoc("__none__"); setCodigoNum("");
    onSuccess();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Completar auditoría</DialogTitle>
          {auditoria && <p className="text-sm text-muted-foreground pt-1">{auditoria.titulo}</p>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-red-600">NC Mayores</Label>
              <Input type="number" min="0" value={ncMayores}
                onChange={e => setNcMayores(e.target.value)}
                className="text-center font-semibold" />
            </div>
            <div className="space-y-2">
              <Label className="text-orange-500">NC Menores</Label>
              <Input type="number" min="0" value={ncMenores}
                onChange={e => setNcMenores(e.target.value)}
                className="text-center font-semibold" />
            </div>
            <div className="space-y-2">
              <Label className="text-yellow-600">Observ.</Label>
              <Input type="number" min="0" value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                className="text-center font-semibold" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Informe (opcional)</Label>
            {tipos.length > 0 && (
              <>
                <Select value={tipoDoc} onValueChange={v => { setTipoDoc(v); setCodigoNum(""); }}>
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
                {tipoDoc !== "__none__" && (
                  <CodigoDocumentoInput
                    prefijo={tipoDoc}
                    value={codigoNum}
                    onChange={setCodigoNum}
                    disabled={loading}
                  />
                )}
              </>
            )}
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center gap-2 justify-center text-sm">
                  <FileCheck className="h-4 w-4 text-green-500" />
                  <span className="truncate max-w-48">{file.name}</span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <Upload className="h-5 w-5 mx-auto mb-1" />
                  Subir informe de auditoría
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Resumen, conclusiones..." rows={3} />
          </div>

          {auditoria?.frecuencia_dias && (
            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-md">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              Se creará automáticamente la próxima auditoría en {auditoria.frecuencia_dias} días
            </div>
          )}

          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Completando...</>
                : <><FileCheck className="mr-2 h-4 w-4" />Completar</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
