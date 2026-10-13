"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SehRequisito, SehUbicacion } from "@/types/seh";

interface SehFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  ubicaciones: SehUbicacion[];
  requisito?: SehRequisito | null;
}

const TIPO_VENCIMIENTO_LABELS: Record<string, string> = {
  fecha_fija: "Fecha fija",
  anual: "Anual",
  periodico: "Periódico",
  sin_vencimiento: "Sin vencimiento",
  segun_plan: "Según plan",
};

export function SehFormDialog({ open, onClose, onSaved, ubicaciones, requisito }: SehFormDialogProps) {
  const isEdit = !!requisito;

  const [nombre, setNombre] = useState(requisito?.nombre ?? "");
  const [ambito, setAmbito] = useState<string>(requisito?.ambito ?? "seguridad_higiene");
  const [ubicacionId, setUbicacionId] = useState(requisito?.ubicacion_id ?? (ubicaciones[0]?.id ?? ""));
  const [norma, setNorma] = useState(requisito?.norma ?? "");
  const [tipoVencimiento, setTipoVencimiento] = useState<string>(requisito?.tipo_vencimiento ?? "fecha_fija");
  const [periodicidadMeses, setPeriodicidadMeses] = useState(requisito?.periodicidad_meses?.toString() ?? "");
  const [aplica, setAplica] = useState(requisito?.aplica ?? true);
  const [observacionGeneral, setObservacionGeneral] = useState(requisito?.observacion_general ?? "");
  // Initial cumplimiento fields (create only)
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [fechaPlanificada, setFechaPlanificada] = useState("");
  const [observacion, setObservacion] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!nombre.trim() || !ubicacionId) {
      setError("Nombre y ubicación son requeridos");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const url = isEdit ? `/api/seh/requisitos/${requisito!.id}` : "/api/seh/requisitos";
      const method = isEdit ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        nombre,
        norma: norma || null,
        tipo_vencimiento: tipoVencimiento,
        periodicidad_meses: tipoVencimiento === "periodico" && periodicidadMeses ? parseInt(periodicidadMeses) : null,
        aplica,
        observacion_general: observacionGeneral || null,
      };

      if (!isEdit) {
        body.ambito = ambito;
        body.ubicacion_id = ubicacionId;
        body.fecha_vencimiento = fechaVencimiento || null;
        body.fecha_planificada = fechaPlanificada || null;
        body.observacion = observacion || null;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al guardar");
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar requisito" : "Nuevo requisito"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del requisito" />
          </div>

          {!isEdit && (
            <>
              <div>
                <Label>Ámbito *</Label>
                <Select value={ambito} onValueChange={setAmbito}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seguridad_higiene">Seguridad e Higiene</SelectItem>
                    <SelectItem value="medio_ambiente">Medio Ambiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Ubicación *</Label>
                <Select value={ubicacionId} onValueChange={setUbicacionId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ubicaciones.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div>
            <Label>Norma / referencia legal</Label>
            <Input value={norma} onChange={(e) => setNorma(e.target.value)} placeholder="Ej: Ley 19.587, Decreto 351/79" />
          </div>

          <div>
            <Label>Tipo de vencimiento</Label>
            <Select value={tipoVencimiento} onValueChange={setTipoVencimiento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_VENCIMIENTO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipoVencimiento === "periodico" && (
            <div>
              <Label>Periodicidad (meses)</Label>
              <Input
                type="number"
                min="1"
                value={periodicidadMeses}
                onChange={(e) => setPeriodicidadMeses(e.target.value)}
                placeholder="Ej: 6"
              />
            </div>
          )}

          <div>
            <Label>¿Aplica?</Label>
            <Select value={aplica ? "si" : "no"} onValueChange={(v) => setAplica(v === "si")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="si">Sí aplica</SelectItem>
                <SelectItem value="no">No corresponde</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observación general</Label>
            <Textarea
              value={observacionGeneral}
              onChange={(e) => setObservacionGeneral(e.target.value)}
              rows={2}
              placeholder="Notas generales del requisito"
            />
          </div>

          {!isEdit && (
            <>
              <hr />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cumplimiento inicial</p>

              <div>
                <Label>Fecha de vencimiento</Label>
                <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
              </div>

              <div>
                <Label>Fecha planificada</Label>
                <Input type="date" value={fechaPlanificada} onChange={(e) => setFechaPlanificada(e.target.value)} />
              </div>

              <div>
                <Label>Observación</Label>
                <Textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  rows={2}
                  placeholder="Observaciones del cumplimiento inicial"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear requisito"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
