"use client";

import { useState } from "react";
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
import { Loader2, X, Plus, LayoutTemplate } from "lucide-react";


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
}

interface ItemFormProps {
  areas: { id: string; nombre: string }[];
  clausulas: { id: string; titulo: string }[];
  usuarios: { id: string; nombre: string }[];
  plantillas: Plantilla[];
  usuarioActual: { rol: string; area_id: string | null; tipos_habilitados: string[] };
  itemInicial?: ItemInicial;
  tipoInicial?: string;
  clausulaInicial?: string;
}

export function ItemForm({ areas, clausulas, usuarios, plantillas, usuarioActual, itemInicial, clausulaInicial }: ItemFormProps) {
  const router = useRouter();
  const supabase = createClient();

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plantillaId, setPlantillaId] = useState("");
  const [archivo] = useState<File | null>(null);

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
    if (!titulo || !clausulaIso) {
      setError("Título y cláusula ISO son obligatorios.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      tipo: "documento",
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
