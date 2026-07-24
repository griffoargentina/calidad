"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X } from "lucide-react";
import { CodigoDocumentoInput } from "@/components/ui/codigo-documento-input";

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
  usuarios: Array<{ id: string; nombre: string }>;
}

export function InstructivoFormDialog({ open, onOpenChange, onSuccess, sectorId, usuarios }: Props) {
  const [nombre, setNombre] = useState("");
  const [responsableId, setResponsableId] = useState("__none__");
  const [esPublico, setEsPublico] = useState(false);
  const [tipoDocId, setTipoDocId] = useState("__none__");
  const [codigoNum, setCodigoNum] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
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
      setCodigoNum("");
      setPendingFile(null);
    }
  }, [open]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    e.target.value = "";
  }

  const selectedTipo = tipos.find((t) => t.id === tipoDocId) ?? null;

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      // Create instructivo first to get an ID
      const res = await fetch("/api/procesos/instructivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector_id: sectorId,
          nombre: nombre.trim(),
          responsable_id: responsableId === "__none__" ? null : responsableId,
          es_publico: esPublico,
          tipo_doc_id: tipoDocId === "__none__" ? null : tipoDocId,
          estado: pendingFile ? "vigente" : "borrador",
        }),
      });
      if (!res.ok) return;
      const instructivo = await res.json();

      // Upload file after creation so we have the instructivo_id and tipo_documento
      if (pendingFile && instructivo?.id) {
        const fd = new FormData();
        fd.append("file", pendingFile);
        fd.append("instructivo_id", instructivo.id);
        if (selectedTipo) {
          fd.append("tipo_documento", selectedTipo.prefijo);
          if (codigoNum) fd.append("codigo_manual", `${selectedTipo.prefijo}-${codigoNum}`);
        }
        await fetch("/api/procesos/instructivos/upload", { method: "POST", body: fd });
      }

      onOpenChange(false);
      onSuccess();
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
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo de documento</label>
              <Select value={tipoDocId} onValueChange={v => { setTipoDocId(v); setCodigoNum(""); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sin código asignado" />
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
              {selectedTipo && (
                <CodigoDocumentoInput
                  prefijo={selectedTipo.prefijo}
                  value={codigoNum}
                  onChange={setCodigoNum}
                  disabled={saving}
                />
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Archivo (opcional)</label>
            <div className="mt-1 flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1.5" />
                Seleccionar archivo
              </Button>
              {pendingFile && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-green-600 truncate max-w-[140px]">{pendingFile.name}</span>
                  <button onClick={() => setPendingFile(null)} className="text-muted-foreground hover:text-destructive">
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
          <Button onClick={handleSave} disabled={saving || !nombre.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
