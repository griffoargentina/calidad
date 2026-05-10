"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TIPO_ITEM_LABELS, TIPO_ITEM_CLAUSULA_PRINCIPAL, FRECUENCIAS_COMUNES } from "@/lib/constants/items";
import { TipoItem } from "@/types/database";
import { Plus, Trash2, LayoutTemplate, Loader2 } from "lucide-react";

interface PlantillaRow {
  id: string;
  nombre: string;
  tipo: string;
  valores_default: Record<string, unknown>;
  usuarios?: { nombre: string } | null;
}

export function PlantillasManager({ plantillas, areas }: {
  plantillas: PlantillaRow[];
  areas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoItem | "">("");
  const [clausulaIso, setClausulaIso] = useState("");
  const [areaId, setAreaId] = useState("__none__");
  const [frecuenciaDias, setFrecuenciaDias] = useState("__none__");

  async function handleCrear() {
    if (!nombre || !tipo) return;
    setLoading(true);
    await supabase.from("plantillas").insert({
      nombre,
      tipo,
      valores_default: {
        clausula_iso: clausulaIso || TIPO_ITEM_CLAUSULA_PRINCIPAL[tipo as TipoItem],
        area_id: areaId && areaId !== "__none__" ? areaId : null,
        frecuencia_dias: frecuenciaDias && frecuenciaDias !== "__none__" ? parseInt(frecuenciaDias) : null,
      },
    });
    setShowForm(false);
    setNombre(""); setTipo(""); setClausulaIso(""); setAreaId("__none__"); setFrecuenciaDias("__none__");
    setLoading(false);
    router.refresh();
  }

  async function handleEliminar(id: string) {
    await supabase.from("plantillas").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Las plantillas aceleran la creación de documentos repetitivos precargando los campos más comunes.
        </p>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nueva plantilla
        </Button>
      </div>

      {plantillas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
          <LayoutTemplate className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No hay plantillas creadas</p>
          <p className="text-xs text-muted-foreground mt-1">Creá tu primera plantilla para acelerar la carga de documentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plantillas.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-semibold">{p.nombre}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleEliminar(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <Badge variant="secondary" className="text-xs mb-2">{TIPO_ITEM_LABELS[p.tipo as TipoItem]}</Badge>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {typeof p.valores_default?.clausula_iso === "string" && <p>Cláusula: {p.valores_default.clausula_iso}</p>}
                  {typeof p.valores_default?.frecuencia_dias === "number" && (
                    <p>Frecuencia: {FRECUENCIAS_COMUNES.find(f => f.dias === (p.valores_default.frecuencia_dias as number))?.label ?? `${p.valores_default.frecuencia_dias} días`}</p>
                  )}
                  <p className="mt-1">Creada por: {p.usuarios?.nombre ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva plantilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la plantilla <span className="text-destructive">*</span></Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Capacitación estándar" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento <span className="text-destructive">*</span></Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoItem); setClausulaIso(TIPO_ITEM_CLAUSULA_PRINCIPAL[v as TipoItem] ?? ""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TIPO_ITEM_LABELS) as [TipoItem, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Área default</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Sin área" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin área</SelectItem>
                  {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frecuencia de revisión default</Label>
              <Select value={frecuenciaDias} onValueChange={setFrecuenciaDias}>
                <SelectTrigger><SelectValue placeholder="Sin frecuencia" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin frecuencia</SelectItem>
                  {FRECUENCIAS_COMUNES.map((f) => <SelectItem key={f.dias} value={f.dias.toString()}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={loading || !nombre || !tipo}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
