"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, X } from "lucide-react";

const FRECUENCIAS = [
  { dias: 30,  label: "Mensual" },
  { dias: 60,  label: "Bimestral" },
  { dias: 90,  label: "Trimestral" },
  { dias: 180, label: "Semestral" },
  { dias: 365, label: "Anual" },
  { dias: 730, label: "Bienal" },
];

interface Usuario { id: string; nombre: string }

interface Props {
  itemId: string;
  descripcion: string | null;
  responsableId: string | null;
  responsableNombre: string | null;
  frecuenciaDias: number | null;
  fechaVencimiento: string | null;
  procFechaVencimiento: string | null;
  usuarios: Usuario[];
  canEdit: boolean;
}

export function QuickEditPanel({ itemId, descripcion, responsableId, responsableNombre, frecuenciaDias, fechaVencimiento, procFechaVencimiento, usuarios, canEdit }: Props) {
  const router = useRouter();
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingResp, setEditingResp] = useState(false);
  const [editingFrec, setEditingFrec] = useState(false);
  const [editingVenc, setEditingVenc] = useState(false);
  const [editingProcVenc, setEditingProcVenc] = useState(false);
  const [descVal, setDescVal] = useState(descripcion ?? "");
  const [respVal, setRespVal] = useState(responsableId ?? "");
  const [frecVal, setFrecVal] = useState(frecuenciaDias?.toString() ?? "");
  const [vencVal, setVencVal] = useState(fechaVencimiento ?? "");
  const [procVencVal, setProcVencVal] = useState(procFechaVencimiento ?? "");
  const [saving, setSaving]   = useState(false);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/items/${itemId}/quick-edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    setEditingDesc(false);
    setEditingResp(false);
    setEditingFrec(false);
    setEditingVenc(false);
    setEditingProcVenc(false);
    router.refresh();
  }

  const frecLabel = frecuenciaDias
    ? (FRECUENCIAS.find(f => f.dias === frecuenciaDias)?.label ?? `Cada ${frecuenciaDias} días`)
    : "Sin frecuencia definida";

  const vencLabel = fechaVencimiento
    ? new Date(fechaVencimiento + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "Sin fecha";

  const procVencLabel = procFechaVencimiento
    ? new Date(procFechaVencimiento + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "Sin fecha";

  return (
    <div className="space-y-4">
      {/* Descripción */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Descripción</p>
        {editingDesc ? (
          <div className="space-y-1.5">
            <Textarea
              value={descVal}
              onChange={e => setDescVal(e.target.value)}
              placeholder="Describí qué es este documento y para qué sirve..."
              className="text-sm min-h-[72px] resize-none"
              rows={3}
            />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2" disabled={saving}
                onClick={() => save({ descripcion: descVal.trim() || null })}>
                <Check className="h-3.5 w-3.5 mr-1 text-green-600" /> Guardar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2"
                onClick={() => { setEditingDesc(false); setDescVal(descripcion ?? ""); }}>
                <X className="h-3.5 w-3.5 mr-1 text-red-500" /> Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className="text-sm flex-1 text-muted-foreground italic">
              {descripcion || <span className="not-italic text-muted-foreground/50">Sin descripción</span>}
            </p>
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-40 hover:opacity-100 shrink-0"
                onClick={() => setEditingDesc(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Responsable */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Responsable</p>
        {editingResp ? (
          <div className="flex items-center gap-2">
            <select
              className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-white"
              value={respVal}
              onChange={e => setRespVal(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={saving}
              onClick={() => save({ responsable_id: respVal || null })}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => { setEditingResp(false); setRespVal(responsableId ?? ""); }}>
              <X className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{responsableNombre ?? "—"}</p>
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-40 hover:opacity-100"
                onClick={() => setEditingResp(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Periodicidad */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Frecuencia de revisión</p>
        {editingFrec ? (
          <div className="flex items-center gap-2">
            <select
              className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-white"
              value={frecVal}
              onChange={e => setFrecVal(e.target.value)}
            >
              <option value="">Sin frecuencia</option>
              {FRECUENCIAS.map(f => (
                <option key={f.dias} value={f.dias}>{f.label}</option>
              ))}
            </select>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={saving}
              onClick={() => save({ frecuencia_dias: frecVal ? parseInt(frecVal) : null })}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => { setEditingFrec(false); setFrecVal(frecuenciaDias?.toString() ?? ""); }}>
              <X className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${!frecuenciaDias ? "text-red-500" : ""}`}>{frecLabel}</p>
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-40 hover:opacity-100"
                onClick={() => setEditingFrec(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Vencimiento documento */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Vencimiento documento</p>
        {editingVenc ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={vencVal}
              onChange={e => setVencVal(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={saving}
              onClick={() => save({ fecha_vencimiento: vencVal || null })}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => { setEditingVenc(false); setVencVal(fechaVencimiento ?? ""); }}>
              <X className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{vencLabel}</p>
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-40 hover:opacity-100"
                onClick={() => setEditingVenc(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Vencimiento procedimiento */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Vencimiento procedimiento</p>
        {editingProcVenc ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={procVencVal}
              onChange={e => setProcVencVal(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={saving}
              onClick={() => save({ proc_fecha_vencimiento: procVencVal || null })}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => { setEditingProcVenc(false); setProcVencVal(procFechaVencimiento ?? ""); }}>
              <X className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{procVencLabel}</p>
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-40 hover:opacity-100"
                onClick={() => setEditingProcVenc(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
