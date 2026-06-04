"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export interface Auditoria {
  id: string;
  titulo: string;
  tipo: "interna" | "externa" | "proveedor" | "proceso";
  norma: string | null;
  fecha_programada: string | null;
  fecha_vencimiento: string;
  frecuencia_dias: number | null;
  estado: "programada" | "en_curso" | "completada" | "vencida";
  nc_mayores: number;
  nc_menores: number;
  observaciones_count: number;
  archivo_url: string | null;
  archivo_nombre: string | null;
  notas: string | null;
  completada_at: string | null;
  created_at: string;
  areas: { id: string; nombre: string } | null;
  responsable: { id: string; nombre: string } | null;
}

const FRECUENCIAS = [
  { label: "Sin periodicidad", value: "" },
  { label: "Mensual (30 días)", value: "30" },
  { label: "Bimestral (60 días)", value: "60" },
  { label: "Trimestral (90 días)", value: "90" },
  { label: "Semestral (180 días)", value: "180" },
  { label: "Anual (365 días)", value: "365" },
];

const TIPOS = [
  { label: "Interna", value: "interna" },
  { label: "Externa", value: "externa" },
  { label: "Proveedor", value: "proveedor" },
  { label: "Proceso", value: "proceso" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  areas: Array<{ id: string; nombre: string }>;
  usuarios: Array<{ id: string; nombre: string }>;
  auditoria?: Auditoria | null;
}

export function AuditoriaFormDialog({ open, onOpenChange, onSuccess, areas, usuarios, auditoria }: Props) {
  const isEdit = !!auditoria;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("interna");
  const [areaId, setAreaId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [norma, setNorma] = useState("ISO 9001:2015");
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [frecuenciaDias, setFrecuenciaDias] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (open) {
      if (auditoria) {
        setTitulo(auditoria.titulo);
        setTipo(auditoria.tipo);
        setAreaId(auditoria.areas?.id ?? "");
        setResponsableId(auditoria.responsable?.id ?? "");
        setNorma(auditoria.norma ?? "ISO 9001:2015");
        setFechaProgramada(auditoria.fecha_programada ?? "");
        setFechaVencimiento(auditoria.fecha_vencimiento);
        setFrecuenciaDias(auditoria.frecuencia_dias?.toString() ?? "");
        setNotas(auditoria.notas ?? "");
      } else {
        setTitulo(""); setTipo("interna"); setAreaId(""); setResponsableId("");
        setNorma("ISO 9001:2015"); setFechaProgramada(""); setFechaVencimiento("");
        setFrecuenciaDias("90"); setNotas("");
      }
      setError(null);
    }
  }, [auditoria, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body = {
      titulo, tipo,
      area_id: areaId || null,
      responsable_id: responsableId || null,
      norma: norma || null,
      fecha_programada: fechaProgramada || null,
      fecha_vencimiento: fechaVencimiento,
      frecuencia_dias: frecuenciaDias ? parseInt(frecuenciaDias) : null,
      notas: notas || null,
    };
    const url = isEdit ? `/api/auditorias/${auditoria!.id}` : "/api/auditorias";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Error al guardar"); return; }
    onSuccess();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar auditoría" : "Nueva auditoría"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Auditoría interna del SGC" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Select value={frecuenciaDias} onValueChange={setFrecuenciaDias}>
                <SelectTrigger><SelectValue placeholder="Sin periodicidad" /></SelectTrigger>
                <SelectContent>
                  {FRECUENCIAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Sin área" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Sin área —</SelectItem>
                  {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={responsableId} onValueChange={setResponsableId}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Sin asignar —</SelectItem>
                  {usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha programada</Label>
              <Input type="date" value={fechaProgramada} onChange={e => setFechaProgramada(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha vencimiento *</Label>
              <Input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Norma / referencia</Label>
            <Input value={norma} onChange={e => setNorma(e.target.value)} placeholder="ISO 9001:2015" />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Alcance, observaciones..." rows={3} />
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : isEdit ? "Guardar cambios" : "Crear auditoría"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
