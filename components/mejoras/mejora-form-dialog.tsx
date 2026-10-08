"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MejoraConFotos, SECTORES, AREAS_OPORTUNIDAD } from "@/types/mejora";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  mejora?: MejoraConFotos | null;
  userName: string;
}

export function MejoraFormDialog({ open, onClose, onSaved, mejora, userName }: Props) {
  const isEdit = !!mejora;

  const [titulo, setTitulo] = useState("");
  const [sector, setSector] = useState("");
  const [sectorCustom, setSectorCustom] = useState("");
  const [maquina, setMaquina] = useState("");
  const [areaOportunidad, setAreaOportunidad] = useState("");
  const [situacionAntes, setSituacionAntes] = useState("");
  const [situacionDespues, setSituacionDespues] = useState("");
  const [accionTomada, setAccionTomada] = useState("");
  const [causaDescripcion, setCausaDescripcion] = useState("");
  const [resultadoCambio, setResultadoCambio] = useState("");
  const [responsable, setResponsable] = useState("");
  const [fechaImpl, setFechaImpl] = useState("");
  const [estado, setEstado] = useState<"en_proceso" | "implementada">("en_proceso");

  // Photo files (create mode only — in edit mode photos are added via detail view)
  const [fotosAntes, setFotosAntes] = useState<FileList | null>(null);
  const [fotosDespues, setFotosDespues] = useState<FileList | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitulo(mejora?.titulo ?? "");
      const knownSector = SECTORES.includes(mejora?.sector as typeof SECTORES[number]);
      setSector(mejora?.sector && knownSector ? mejora.sector : mejora?.sector ? "otro" : "");
      setSectorCustom(mejora?.sector && !knownSector ? mejora.sector : "");
      setMaquina(mejora?.maquina_equipo ?? "");
      setAreaOportunidad(mejora?.area_oportunidad ?? "");
      setSituacionAntes(mejora?.situacion_antes ?? "");
      setSituacionDespues(mejora?.situacion_despues ?? "");
      setAccionTomada(mejora?.accion_tomada ?? "");
      setCausaDescripcion(mejora?.causa_descripcion ?? "");
      setResultadoCambio(mejora?.resultado_cambio ?? "");
      setResponsable(mejora?.responsable_nombre ?? (isEdit ? "" : userName));
      setFechaImpl(mejora?.fecha_implementacion ?? "");
      setEstado(mejora?.estado ?? "en_proceso");
      setFotosAntes(null);
      setFotosDespues(null);
      setError(null);
    }
  }, [open, mejora, isEdit, userName]);

  async function handleSave() {
    const sectorFinal = sector === "otro" ? sectorCustom.trim() : sector;
    if (!titulo.trim() || !sectorFinal) {
      setError("Título y sector son requeridos");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = {
        titulo: titulo.trim(),
        sector: sectorFinal,
        maquina_equipo: maquina || null,
        area_oportunidad: areaOportunidad || null,
        situacion_antes: situacionAntes || null,
        situacion_despues: situacionDespues || null,
        accion_tomada: accionTomada || null,
        causa_descripcion: causaDescripcion || null,
        resultado_cambio: resultadoCambio || null,
        responsable_nombre: responsable || null,
        fecha_implementacion: fechaImpl || null,
        estado,
      };

      const url = isEdit ? `/api/mejoras/${mejora!.id}` : "/api/mejoras";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Error al guardar");
      }

      const data = await res.json();

      // Upload photos (create mode only)
      if (!isEdit && data.id) {
        const uploads: Promise<unknown>[] = [];
        if (fotosAntes) {
          Array.from(fotosAntes).forEach((f) => {
            const fd = new FormData();
            fd.append("file", f);
            fd.append("mejora_id", data.id);
            fd.append("tipo", "antes");
            uploads.push(fetch("/api/mejoras/fotos", { method: "POST", body: fd }));
          });
        }
        if (fotosDespues) {
          Array.from(fotosDespues).forEach((f) => {
            const fd = new FormData();
            fd.append("file", f);
            fd.append("mejora_id", data.id);
            fd.append("tipo", "despues");
            uploads.push(fetch("/api/mejoras/fotos", { method: "POST", body: fd }));
          });
        }
        if (uploads.length) await Promise.all(uploads);
      }

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar mejora" : "Registrar nueva mejora"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Título */}
          <div>
            <Label>Descripción de la mejora *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Organización del área de corte por talla"
            />
          </div>

          {/* Sector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sector *</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue placeholder="Seleccioná…" /></SelectTrigger>
                <SelectContent>
                  {SECTORES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  <SelectItem value="otro">Otro…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {sector === "otro" && (
              <div>
                <Label>Especificá el sector</Label>
                <Input value={sectorCustom} onChange={(e) => setSectorCustom(e.target.value)} placeholder="Nombre del sector" />
              </div>
            )}
            {sector !== "otro" && (
              <div>
                <Label>Máquina / equipo</Label>
                <Input value={maquina} onChange={(e) => setMaquina(e.target.value)} placeholder="Ej: Mesa de corte 3" />
              </div>
            )}
          </div>
          {sector === "otro" && (
            <div>
              <Label>Máquina / equipo</Label>
              <Input value={maquina} onChange={(e) => setMaquina(e.target.value)} placeholder="Ej: Mesa de corte 3" />
            </div>
          )}

          {/* Área de oportunidad */}
          <div>
            <Label>Área de oportunidad</Label>
            <Select value={areaOportunidad} onValueChange={setAreaOportunidad}>
              <SelectTrigger><SelectValue placeholder="Seleccioná…" /></SelectTrigger>
              <SelectContent>
                {AREAS_OPORTUNIDAD.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Situación</p>

          {/* Antes */}
          <div>
            <Label>Situación anterior</Label>
            <Textarea
              rows={2}
              value={situacionAntes}
              onChange={(e) => setSituacionAntes(e.target.value)}
              placeholder="Describí cómo estaba antes de la mejora"
            />
          </div>
          {!isEdit && (
            <div>
              <Label>Fotos del antes</Label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFotosAntes(e.target.files)}
                className="text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:text-xs file:font-medium file:border-0 file:bg-slate-100 file:rounded file:px-2 file:py-1"
              />
            </div>
          )}

          {/* Después */}
          <div>
            <Label>Situación posterior</Label>
            <Textarea
              rows={2}
              value={situacionDespues}
              onChange={(e) => setSituacionDespues(e.target.value)}
              placeholder="Describí el resultado obtenido"
            />
          </div>
          {!isEdit && (
            <div>
              <Label>Fotos del después</Label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFotosDespues(e.target.files)}
                className="text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:text-xs file:font-medium file:border-0 file:bg-slate-100 file:rounded file:px-2 file:py-1"
              />
            </div>
          )}

          <hr className="border-slate-200 dark:border-slate-700" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Análisis</p>

          <div>
            <Label>Acción tomada</Label>
            <Textarea rows={2} value={accionTomada} onChange={(e) => setAccionTomada(e.target.value)} placeholder="¿Qué se hizo?" />
          </div>

          <div>
            <Label>Causa / descripción del cambio</Label>
            <Textarea rows={2} value={causaDescripcion} onChange={(e) => setCausaDescripcion(e.target.value)} placeholder="¿Por qué se necesitaba esta mejora?" />
          </div>

          <div>
            <Label>Resultado del cambio</Label>
            <Textarea rows={2} value={resultadoCambio} onChange={(e) => setResultadoCambio(e.target.value)} placeholder="¿Qué se logró?" />
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsable</Label>
              <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre" />
            </div>
            <div>
              <Label>Fecha de implementación</Label>
              <Input type="date" value={fechaImpl} onChange={(e) => setFechaImpl(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as "en_proceso" | "implementada")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en_proceso">En proceso</SelectItem>
                <SelectItem value="implementada">Implementada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Registrar mejora"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
