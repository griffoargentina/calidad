"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Download, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Calibracion {
  id: string;
  equipo_id: string;
  fecha_calibracion: string;
  fecha_vencimiento: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  observaciones: string | null;
  created_at: string;
}

interface Procedimiento {
  id: string;
  titulo: string;
}

interface Equipo {
  id: string;
  nombre: string;
  codigo: string | null;
  rango_max: string | null;
  identificacion_serie: string | null;
  tipo: string | null;
  procedimiento_id: string | null;
  lugar_uso: string | null;
  frecuencia: string | null;
  activo: boolean;
  procedimiento: Procedimiento | null;
  ultima_calibracion: Calibracion | null;
}

interface Props {
  equiposIniciales: Equipo[];
  canEdit: boolean;
}

function semaforo(vencimiento: string | null): "verde" | "amarillo" | "rojo" | "sin" {
  if (!vencimiento) return "sin";
  const diff = Math.floor((new Date(vencimiento).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "rojo";
  if (diff <= 30) return "amarillo";
  return "verde";
}

const SEMAFORO_COLORS = { verde: "bg-green-500", amarillo: "bg-yellow-400", rojo: "bg-red-500", sin: "bg-gray-300" };
const FRECUENCIA_LABELS: Record<string, string> = { semestral: "Semestral", anual: "Anual", trimestral: "Trimestral", mensual: "Mensual" };

const EMPTY_EQUIPO = { nombre: "", codigo: "", rango_max: "", identificacion_serie: "", tipo: "interna", procedimiento_id: "", lugar_uso: "", frecuencia: "anual" };

export function EquiposTab({ equiposIniciales, canEdit }: Props) {
  const [equipos, setEquipos] = useState<Equipo[]>(equiposIniciales);
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([]);
  const [procLoaded, setProcLoaded] = useState(false);

  // Equipo dialog
  const [equipoDialog, setEquipoDialog] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<Equipo | null>(null);
  const [form, setForm] = useState(EMPTY_EQUIPO);
  const [saving, setSaving] = useState(false);

  // Detail panel
  const [selectedEquipo, setSelectedEquipo] = useState<Equipo | null>(null);
  const [calibraciones, setCalibacionesMap] = useState<Record<string, Calibracion[]>>({});
  const [loadingCal, setLoadingCal] = useState(false);

  // Calibracion dialog
  const [calDialog, setCalDialog] = useState(false);
  const [calForm, setCalForm] = useState({ fecha_calibracion: "", fecha_vencimiento: "", observaciones: "" });
  const [calFile, setCalFile] = useState<File | null>(null);
  const [savingCal, setSavingCal] = useState(false);
  const calFileRef = useRef<HTMLInputElement>(null);

  async function loadProcedimientos() {
    if (procLoaded) return;
    const res = await fetch("/api/calibracion/procedimientos");
    const data = await res.json();
    setProcedimientos(data);
    setProcLoaded(true);
  }

  async function openNewEquipo() {
    await loadProcedimientos();
    setEditingEquipo(null);
    setForm(EMPTY_EQUIPO);
    setEquipoDialog(true);
  }

  async function openEditEquipo(e: Equipo) {
    await loadProcedimientos();
    setEditingEquipo(e);
    setForm({
      nombre: e.nombre,
      codigo: e.codigo ?? "",
      rango_max: e.rango_max ?? "",
      identificacion_serie: e.identificacion_serie ?? "",
      tipo: e.tipo ?? "interna",
      procedimiento_id: e.procedimiento_id ?? "",
      lugar_uso: e.lugar_uso ?? "",
      frecuencia: e.frecuencia ?? "anual",
    });
    setEquipoDialog(true);
  }

  async function handleSaveEquipo() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const body = { ...form, procedimiento_id: form.procedimiento_id || null };
    if (editingEquipo) {
      const res = await fetch(`/api/calibracion/equipos/${editingEquipo.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const updated = await res.json();
      const proc = procedimientos.find((p) => p.id === updated.procedimiento_id) ?? null;
      setEquipos((prev) => prev.map((e) => e.id === editingEquipo.id ? { ...e, ...updated, procedimiento: proc } : e));
      if (selectedEquipo?.id === editingEquipo.id) setSelectedEquipo((prev) => prev ? { ...prev, ...updated, procedimiento: proc } : null);
    } else {
      const res = await fetch("/api/calibracion/equipos", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const created = await res.json();
      const proc = procedimientos.find((p) => p.id === created.procedimiento_id) ?? null;
      setEquipos((prev) => [...prev, { ...created, procedimiento: proc, ultima_calibracion: null }]);
    }
    setSaving(false);
    setEquipoDialog(false);
  }

  async function handleDeleteEquipo(id: string) {
    if (!confirm("¿Eliminar este equipo y todo su historial?")) return;
    await fetch(`/api/calibracion/equipos/${id}`, { method: "DELETE" });
    setEquipos((prev) => prev.filter((e) => e.id !== id));
    if (selectedEquipo?.id === id) setSelectedEquipo(null);
  }

  async function openDetail(equipo: Equipo) {
    setSelectedEquipo(equipo);
    if (!calibraciones[equipo.id]) {
      setLoadingCal(true);
      const res = await fetch(`/api/calibracion/equipos/${equipo.id}/calibraciones`);
      const data = await res.json();
      setCalibacionesMap((prev) => ({ ...prev, [equipo.id]: data }));
      setLoadingCal(false);
    }
  }

  function openCalDialog() {
    setCalForm({ fecha_calibracion: "", fecha_vencimiento: "", observaciones: "" });
    setCalFile(null);
    setCalDialog(true);
  }

  async function handleSaveCal() {
    if (!selectedEquipo || !calForm.fecha_calibracion || !calForm.fecha_vencimiento) return;
    setSavingCal(true);

    let archivo_url = null;
    let archivo_nombre = null;

    if (calFile) {
      const fd = new FormData();
      fd.append("file", calFile);
      fd.append("folder", `calibraciones/${selectedEquipo.id}`);
      const uploadRes = await fetch("/api/calibracion/upload", { method: "POST", body: fd });
      const uploaded = await uploadRes.json();
      archivo_url = uploaded.url;
      archivo_nombre = uploaded.nombre;
    }

    const res = await fetch(`/api/calibracion/equipos/${selectedEquipo.id}/calibraciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...calForm, archivo_url, archivo_nombre }),
    });
    const created = await res.json();

    setCalibacionesMap((prev) => ({
      ...prev,
      [selectedEquipo.id]: [created, ...(prev[selectedEquipo.id] ?? [])],
    }));

    // Update ultima_calibracion on equipo
    setEquipos((prev) => prev.map((e) =>
      e.id === selectedEquipo.id ? { ...e, ultima_calibracion: created } : e
    ));
    setSelectedEquipo((prev) => prev ? { ...prev, ultima_calibracion: created } : null);

    setSavingCal(false);
    setCalDialog(false);
  }

  const activeCals = selectedEquipo ? (calibraciones[selectedEquipo.id] ?? []) : [];

  return (
    <div className="flex gap-4 h-full">
      {/* Table */}
      <div className={cn("flex-1 min-w-0", selectedEquipo ? "hidden lg:block" : "")}>
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-muted-foreground">{equipos.length} equipo{equipos.length !== 1 ? "s" : ""}</p>
          {canEdit && (
            <Button size="sm" onClick={openNewEquipo}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo equipo
            </Button>
          )}
        </div>

        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">N°</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Equipo</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Código</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rango</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Serie</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Procedimiento</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Lugar</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Frecuencia</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Vencimiento</th>
                <th className="px-3 py-2 w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {equipos.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">No hay equipos cargados.</td></tr>
              ) : equipos.map((eq, i) => {
                const sem = semaforo(eq.ultima_calibracion?.fecha_vencimiento ?? null);
                return (
                  <tr key={eq.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => openDetail(eq)}
                  >
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{eq.nombre}</td>
                    <td className="px-3 py-2 text-muted-foreground">{eq.codigo ?? "—"}</td>
                    <td className="px-3 py-2">{eq.rango_max ?? "—"}</td>
                    <td className="px-3 py-2">{eq.identificacion_serie ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs capitalize">{eq.tipo ?? "—"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{eq.procedimiento?.titulo ?? "—"}</td>
                    <td className="px-3 py-2">{eq.lugar_uso ?? "—"}</td>
                    <td className="px-3 py-2 capitalize">{eq.frecuencia ? FRECUENCIA_LABELS[eq.frecuencia] : "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", SEMAFORO_COLORS[sem])} />
                        <span className="text-xs">{eq.ultima_calibracion?.fecha_vencimiento ?? "Sin registro"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedEquipo && (
        <div className="w-full lg:w-96 shrink-0 bg-white border rounded-lg flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <p className="font-semibold text-sm">{selectedEquipo.nombre}</p>
              {selectedEquipo.codigo && <p className="text-xs text-muted-foreground">{selectedEquipo.codigo}</p>}
            </div>
            <div className="flex gap-1">
              {canEdit && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => openEditEquipo(selectedEquipo)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteEquipo(selectedEquipo.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedEquipo(null)}>✕</Button>
            </div>
          </div>

          <div className="px-4 py-3 border-b space-y-1 text-sm">
            {selectedEquipo.rango_max && <p><span className="text-muted-foreground">Rango:</span> {selectedEquipo.rango_max}</p>}
            {selectedEquipo.identificacion_serie && <p><span className="text-muted-foreground">Serie:</span> {selectedEquipo.identificacion_serie}</p>}
            {selectedEquipo.lugar_uso && <p><span className="text-muted-foreground">Lugar:</span> {selectedEquipo.lugar_uso}</p>}
            {selectedEquipo.frecuencia && <p><span className="text-muted-foreground">Frecuencia:</span> {FRECUENCIA_LABELS[selectedEquipo.frecuencia]}</p>}
            {selectedEquipo.procedimiento && <p><span className="text-muted-foreground">Procedimiento:</span> {selectedEquipo.procedimiento.titulo}</p>}
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-medium">Historial de calibraciones</p>
            {canEdit && (
              <Button size="sm" onClick={openCalDialog}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Registrar
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {loadingCal ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : activeCals.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin registros</p>
            ) : activeCals.map((c) => {
              const sem = semaforo(c.fecha_vencimiento);
              return (
                <div key={c.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", SEMAFORO_COLORS[sem])} />
                    <span className="text-xs font-medium">Calibrado: {c.fecha_calibracion}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Vence: {c.fecha_vencimiento}</p>
                  {c.observaciones && <p className="text-xs text-muted-foreground">{c.observaciones}</p>}
                  {c.archivo_url && (
                    <a href={c.archivo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Download className="h-3 w-3" />
                      {c.archivo_nombre ?? "Certificado"}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Equipo dialog */}
      <Dialog open={equipoDialog} onOpenChange={setEquipoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEquipo ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium">Nombre *</label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: BALANZA 001" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Código</label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="BA 001" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Rango máximo</label>
              <Input value={form.rango_max} onChange={(e) => setForm({ ...form, rango_max: e.target.value })} placeholder="150 Kg" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Identificación / Serie</label>
              <Input value={form.identificacion_serie} onChange={(e) => setForm({ ...form, identificacion_serie: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Lugar de uso</label>
              <Input value={form.lugar_uso} onChange={(e) => setForm({ ...form, lugar_uso: e.target.value })} placeholder="Mezclado" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo de calibración</label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interna">Interna</SelectItem>
                  <SelectItem value="externa">Externa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Frecuencia</label>
              <Select value={form.frecuencia} onValueChange={(v) => setForm({ ...form, frecuencia: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Procedimiento de calibración</label>
              <Select value={form.procedimiento_id || "none"} onValueChange={(v) => setForm({ ...form, procedimiento_id: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sin procedimiento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin procedimiento</SelectItem>
                  {procedimientos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEquipoDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEquipo} disabled={saving || !form.nombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calibracion dialog */}
      <Dialog open={calDialog} onOpenChange={setCalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar calibración</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Fecha de calibración *</label>
                <Input type="date" value={calForm.fecha_calibracion} onChange={(e) => setCalForm({ ...calForm, fecha_calibracion: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Fecha de vencimiento *</label>
                <Input type="date" value={calForm.fecha_vencimiento} onChange={(e) => setCalForm({ ...calForm, fecha_vencimiento: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Observaciones</label>
              <Input value={calForm.observaciones} onChange={(e) => setCalForm({ ...calForm, observaciones: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Certificado (PDF/Word)</label>
              <div className="mt-1 flex items-center gap-2">
                <input ref={calFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setCalFile(e.target.files?.[0] ?? null)} />
                <Button variant="outline" size="sm" type="button" onClick={() => calFileRef.current?.click()}>
                  {calFile ? calFile.name : "Elegir archivo"}
                </Button>
                {calFile && <span className="text-xs text-muted-foreground truncate">{calFile.name}</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCalDialog(false)} disabled={savingCal}>Cancelar</Button>
            <Button onClick={handleSaveCal} disabled={savingCal || !calForm.fecha_calibracion || !calForm.fecha_vencimiento}>
              {savingCal && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
