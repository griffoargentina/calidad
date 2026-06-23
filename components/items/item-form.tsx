"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FRECUENCIAS_COMUNES,
} from "@/lib/constants/items";
import { Loader2, X, Plus, LayoutTemplate, Upload, FileText } from "lucide-react";
import { useRef } from "react";

const TIPO_DOCUMENTO_OPTIONS = [
  { value: "MA", label: "MA — Manual" },
  { value: "PR", label: "PR — Procedimiento" },
  { value: "IT", label: "IT — Instructivo de Trabajo" },
  { value: "FO", label: "FO — Formato / Formulario" },
  { value: "RE", label: "RE — Registro" },
  { value: "DS", label: "DS — Documento de Soporte" },
];

interface Plantilla {
  id: string;
  nombre: string;
  tipo: string;
  valores_default: Record<string, unknown>;
}

interface ItemInicial {
  id: string;
  tipo?: string | null;
  tipo_documento?: string | null;
  titulo: string;
  descripcion: string | null;
  clausula_iso: string;
  area_id: string | null;
  responsable_id: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  frecuencia_dias: number | null;
  requiere_aprobacion: boolean;
  es_borrador: boolean;
  etiquetas: string[];
  version_actual?: number;
  codigo?: string | null;
}

interface ItemFormProps {
  areas: { id: string; nombre: string }[];
  clausulas: { id: string; titulo: string }[];
  usuarios: { id: string; nombre: string }[];
  plantillas: Plantilla[];
  usuarioActual: { rol: string; area_id: string | null; tipos_habilitados: string[] };
  itemInicial?: ItemInicial;
  clausulaInicial?: string;
}

export function ItemForm({ areas, clausulas, usuarios, plantillas, usuarioActual, itemInicial, clausulaInicial }: ItemFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [tipoDocumento, setTipoDocumento] = useState(itemInicial?.tipo_documento ?? "");
  const [codigoPreview, setCodigoPreview] = useState<string | null>(itemInicial?.codigo ?? null);
  const [titulo, setTitulo] = useState(itemInicial?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(itemInicial?.descripcion ?? "");
  const [clausulaIso, setClausulaIso] = useState(itemInicial?.clausula_iso ?? clausulaInicial ?? "");
  const [areaId, setAreaId] = useState(itemInicial?.area_id ?? usuarioActual.area_id ?? "__none__");
  const [responsableId, setResponsableId] = useState(itemInicial?.responsable_id ?? "__none__");
  const [fechaEmision] = useState(itemInicial?.fecha_emision ?? new Date().toISOString().split("T")[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState(itemInicial?.fecha_vencimiento ?? "");
  const [frecuenciaDias, setFrecuenciaDias] = useState<string>(itemInicial?.frecuencia_dias?.toString() ?? "__none__");
  const [etiquetas, setEtiquetas] = useState<string[]>(itemInicial?.etiquetas ?? []);
  const [etiquetaInput, setEtiquetaInput] = useState("");
  const [versionActual, setVersionActual] = useState<string>(itemInicial?.version_actual?.toString() ?? "0");

  useEffect(() => {
    if (!tipoDocumento || itemInicial?.codigo) return;
    fetch(`/api/items/preview-codigo?prefijo=${tipoDocumento}`)
      .then((r) => r.json())
      .then((d) => { if (d.codigo) setCodigoPreview(d.codigo); });
  }, [tipoDocumento, itemInicial?.codigo]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plantillaId, setPlantillaId] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Aplicar plantilla
  function aplicarPlantilla(id: string) {
    const p = plantillas.find((pl) => pl.id === id);
    if (!p) return;
    const v = p.valores_default ?? {};
    if (typeof v.clausula_iso === "string") setClausulaIso(v.clausula_iso);
    if (typeof v.area_id === "string") setAreaId(v.area_id);
    if (typeof v.frecuencia_dias === "number") setFrecuenciaDias(v.frecuencia_dias.toString());
    if (Array.isArray(v.etiquetas)) setEtiquetas(v.etiquetas as string[]);
    setPlantillaId(id);
  }

  // Calcular vencimiento desde frecuencia
  function calcularVencimiento(dias: string) {
    if (!dias || !fechaEmision) return;
    const fecha = new Date(fechaEmision);
    fecha.setDate(fecha.getDate() + parseInt(dias));
    setFechaVencimiento(fecha.toISOString().split("T")[0]);
  }

  function addEtiqueta() {
    const tag = etiquetaInput.trim();
    if (tag && !etiquetas.includes(tag)) {
      setEtiquetas([...etiquetas, tag]);
    }
    setEtiquetaInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipoDocumento || !titulo || !clausulaIso) {
      setError("Tipo de documento, título y cláusula ISO son obligatorios.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      tipo: "documento",
      tipo_documento: tipoDocumento,
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      clausula_iso: clausulaIso,
      area_id: areaId && areaId !== "__none__" ? areaId : null,
      responsable_id: responsableId && responsableId !== "__none__" ? responsableId : null,
      fecha_emision: fechaEmision || null,
      fecha_vencimiento: fechaVencimiento || null,
      frecuencia_dias: frecuenciaDias && frecuenciaDias !== "__none__" ? parseInt(frecuenciaDias) : null,
      requiere_aprobacion: false,
      es_borrador: false,
      etiquetas,
      version_actual: parseInt(versionActual) || 0,
      estado: "vigente",
    };

    let result;
    if (itemInicial) {
      result = await supabase.from("items").update(payload).eq("id", itemInicial.id).select().single();
    } else {
      result = await supabase.from("items").insert(payload).select().single();
    }

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    // Subir archivo si se adjuntó
    if (archivo) {
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("item_id", result.data.id);
      fd.append("categoria", "documento");
      fd.append("version", "1");
      await fetch("/api/upload", { method: "POST", body: fd });
    }

    router.push(`/items/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plantillas */}
      {plantillas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Crear desde plantilla (opcional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={plantillaId} onValueChange={aplicarPlantilla}>
              <SelectTrigger>
                <SelectValue placeholder="Elegir plantilla..." />
              </SelectTrigger>
              <SelectContent>
                {plantillas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Datos principales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Datos del documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de documento <span className="text-destructive">*</span></Label>
              <Select value={tipoDocumento} onValueChange={setTipoDocumento} required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_DOCUMENTO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {codigoPreview && (
                <p className="text-xs text-muted-foreground">
                  Código asignado: <span className="font-mono font-semibold text-slate-700">{codigoPreview}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Cláusula ISO <span className="text-destructive">*</span></Label>
              {clausulaInicial ? (
                <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed truncate">
                  {clausulaIso} — {clausulas.find(c => c.id === clausulaIso)?.titulo ?? ""}
                </div>
              ) : (
                <Select value={clausulaIso} onValueChange={setClausulaIso} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cláusula..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clausulas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.id} — {c.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Procedimiento de control de documentos"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Nº de revisión</Label>
            <Input
              type="number"
              min={0}
              value={versionActual}
              onChange={(e) => setVersionActual(e.target.value)}
              placeholder="0"
              className="max-w-xs"
            />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción o alcance del documento..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Responsable y área */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Responsable y área</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar área..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin área</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={responsableId} onValueChange={setResponsableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar responsable..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin responsable específico</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Frecuencia */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Frecuencia de revisión</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Select
              value={frecuenciaDias}
              onValueChange={(v) => {
                setFrecuenciaDias(v);
                calcularVencimiento(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegir frecuencia..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin frecuencia</SelectItem>
                {FRECUENCIAS_COMUNES.map((f) => (
                  <SelectItem key={f.dias} value={f.dias.toString()}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Cada cuánto debe revisarse este documento.</p>
          </div>
        </CardContent>
      </Card>

      {/* Etiquetas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Etiquetas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={etiquetaInput}
              onChange={(e) => setEtiquetaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEtiqueta(); } }}
              placeholder="Ej: crítico, auditoría 2026..."
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={addEtiqueta} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {etiquetas.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => setEtiquetas(etiquetas.filter((t) => t !== tag))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archivo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Documento (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:border-primary transition-colors"
          >
            {archivo ? (
              <div className="flex items-center justify-center gap-2 text-primary">
                <FileText className="h-5 w-5" />
                <span className="text-sm font-medium truncate max-w-xs">{archivo.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setArchivo(null); }}
                  className="text-muted-foreground hover:text-destructive ml-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Upload className="h-7 w-7 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Cliqueá para adjuntar el documento</p>
                <p className="text-xs mt-1 opacity-70">PDF, Excel, Word — opcional</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setArchivo(f); }}
          />
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">{error}</p>
      )}

      <div className="flex gap-3 justify-end pb-8">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
          ) : (
            itemInicial ? "Guardar cambios" : "Crear documento"
          )}
        </Button>
      </div>
    </form>
  );
}
