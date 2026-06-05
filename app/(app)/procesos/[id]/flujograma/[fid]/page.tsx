"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Save, Plus, GripVertical, Pencil, Trash2, X, Loader2, FileText,
} from "lucide-react";

interface Sector { id: string; nombre: string }
interface Instructivo { id: string; nombre: string; version: number; estado: string }
interface Paso {
  id: string;
  flujograma_id: string;
  orden: number;
  nombre: string;
  tipo: "inicio" | "proceso" | "decision" | "fin";
  descripcion: string | null;
  rama_si: number | null;
  rama_no: number | null;
  sectores: Sector[];
  instructivo: Instructivo | null;
}
interface Flujograma {
  id: string;
  nombre: string;
  sector_id: string;
  version: number;
  estado: string;
  sector: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
  pasos: Paso[];
}

const TIPO_COLORS: Record<string, string> = {
  inicio: "bg-gray-100 text-gray-700",
  proceso: "bg-blue-100 text-blue-700",
  decision: "bg-amber-100 text-amber-700",
  fin: "bg-gray-100 text-gray-700",
};
const TIPO_LABELS: Record<string, string> = {
  inicio: "INICIO", proceso: "PROCESO", decision: "DECISIÓN", fin: "FIN",
};

type PasoForm = {
  nombre: string;
  tipo: string;
  descripcion: string;
  sectores: string[];
  instructivo_id: string;
  rama_si: string;
  rama_no: string;
};

const EMPTY_FORM: PasoForm = {
  nombre: "", tipo: "proceso", descripcion: "", sectores: [],
  instructivo_id: "__none__", rama_si: "", rama_no: "",
};

export default function FlujogramaEditorPage() {
  const params = useParams();
  const router = useRouter();
  const sectorId = params.id as string;
  const fid = params.fid as string;

  const [flujograma, setFlujograma] = useState<Flujograma | null>(null);
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [userRol, setUserRol] = useState("lector");
  const [allSectores, setAllSectores] = useState<Sector[]>([]);
  const [sectorInstructivos, setSectorInstructivos] = useState<Instructivo[]>([]);

  // Add paso inline form
  const [addingPaso, setAddingPaso] = useState(false);
  const [newPasoNombre, setNewPasoNombre] = useState("");
  const [newPasoTipo, setNewPasoTipo] = useState("proceso");
  const [savingNewPaso, setSavingNewPaso] = useState(false);

  // Edit panel
  const [editingPaso, setEditingPaso] = useState<Paso | null>(null);
  const [editForm, setEditForm] = useState<PasoForm>(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  // Drag state
  const dragIdx = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/procesos/flujogramas/${fid}`);
    if (!res.ok) { router.push(`/procesos/${sectorId}`); return; }
    const data: Flujograma = await res.json();
    setFlujograma(data);
    setPasos(data.pasos ?? []);
    setLoading(false);
    setDirty(false);
  }, [fid, sectorId, router]);

  useEffect(() => {
    load();
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
      setUserRol(data?.rol ?? "lector");
    });
    supabase.from("proc_sectores").select("id, nombre").eq("activo", true).order("orden").then(({ data }) => {
      setAllSectores(data ?? []);
    });
  }, [load]);

  // Load instructivos for this sector when flujograma is loaded
  useEffect(() => {
    if (!flujograma) return;
    fetch(`/api/procesos/instructivos?sector_id=${flujograma.sector_id}`)
      .then((r) => r.json())
      .then((d) => setSectorInstructivos(Array.isArray(d) ? d : []));
  }, [flujograma]);

  const canEdit = ["admin", "editor"].includes(userRol);
  const isAdmin = userRol === "admin";

  // Save reordering to API
  async function handleSaveOrder() {
    setSaving(true);
    await fetch(`/api/procesos/flujogramas/${fid}/pasos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pasos.map((p, i) => ({ id: p.id, orden: i }))),
    });
    setSaving(false);
    setDirty(false);
  }

  // Drag-and-drop handlers
  function handleDragStart(idx: number) { dragIdx.current = idx; }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const newPasos = [...pasos];
    const [moved] = newPasos.splice(dragIdx.current, 1);
    newPasos.splice(idx, 0, moved);
    dragIdx.current = idx;
    setPasos(newPasos.map((p, i) => ({ ...p, orden: i })));
    setDirty(true);
  }
  function handleDragEnd() { dragIdx.current = null; }

  async function handleAddPaso() {
    if (!newPasoNombre.trim()) return;
    setSavingNewPaso(true);
    const res = await fetch(`/api/procesos/flujogramas/${fid}/pasos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: newPasoNombre.trim(), tipo: newPasoTipo }),
    });
    const created = await res.json();
    if (created.id) {
      setPasos((prev) => [...prev, { ...created, sectores: [], instructivo: null }]);
      setNewPasoNombre("");
      setNewPasoTipo("proceso");
      setAddingPaso(false);
    }
    setSavingNewPaso(false);
  }

  async function handleDeletePaso(paso: Paso) {
    if (!confirm(`¿Eliminar el paso "${paso.nombre}"?`)) return;
    await fetch(`/api/procesos/flujogramas/${fid}/pasos/${paso.id}`, { method: "DELETE" });
    await load();
  }

  function openEditPaso(paso: Paso) {
    setEditingPaso(paso);
    setEditForm({
      nombre: paso.nombre,
      tipo: paso.tipo,
      descripcion: paso.descripcion ?? "",
      sectores: paso.sectores.map((s) => s.id),
      instructivo_id: paso.instructivo?.id ?? "__none__",
      rama_si: paso.rama_si != null ? String(paso.rama_si) : "",
      rama_no: paso.rama_no != null ? String(paso.rama_no) : "",
    });
  }

  async function handleSaveEdit() {
    if (!editingPaso || !editForm.nombre.trim()) return;
    setSavingEdit(true);
    const body: Record<string, unknown> = {
      nombre: editForm.nombre.trim(),
      tipo: editForm.tipo,
      descripcion: editForm.descripcion || null,
      sectores: editForm.sectores,
      instructivo_id: editForm.instructivo_id === "__none__" ? null : editForm.instructivo_id,
    };
    if (editForm.tipo === "decision") {
      body.rama_si = editForm.rama_si !== "" ? parseInt(editForm.rama_si) : null;
      body.rama_no = editForm.rama_no !== "" ? parseInt(editForm.rama_no) : null;
    } else {
      body.rama_si = null;
      body.rama_no = null;
    }

    const res = await fetch(`/api/procesos/flujogramas/${fid}/pasos/${editingPaso.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await load();
      setEditingPaso(null);
    }
    setSavingEdit(false);
  }

  const sectorNombre = (() => {
    if (!flujograma?.sector) return "";
    const s = Array.isArray(flujograma.sector) ? flujograma.sector[0] : flujograma.sector;
    return s?.nombre ?? "";
  })();

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Flujograma" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!flujograma) return null;

  return (
    <div className="flex flex-col h-full">
      <Topbar title={flujograma.nombre} />

      <div className="flex-1 flex overflow-hidden">
        {/* Main area */}
        <div className={`flex flex-col flex-1 overflow-hidden ${editingPaso ? "w-[60%]" : "w-full"}`}>
          {/* Sub-header */}
          <div className="border-b bg-white px-6 py-3 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="h-7 px-2"
                onClick={() => router.push(`/procesos/${sectorId}`)}>
                <ArrowLeft className="h-4 w-4 mr-1" />Sector
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{flujograma.nombre}</span>
                  <span className="text-xs text-muted-foreground">v{flujograma.version}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    flujograma.estado === "vigente" ? "bg-green-100 text-green-700" :
                    flujograma.estado === "borrador" ? "bg-slate-100 text-slate-600" :
                    "bg-gray-100 text-gray-500"
                  }`}>{flujograma.estado}</span>
                </div>
                <p className="text-xs text-muted-foreground">{sectorNombre}</p>
              </div>
            </div>
            {canEdit && dirty && (
              <Button size="sm" onClick={handleSaveOrder} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Guardar orden
              </Button>
            )}
          </div>

          {/* Pasos list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {pasos.length === 0 && !addingPaso && (
              <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-sm">No hay pasos en este flujograma.</p>
                {canEdit && <p className="text-xs">Hacé clic en &quot;Agregar paso&quot; para empezar.</p>}
              </div>
            )}

            {pasos.map((paso, idx) => (
              <div
                key={paso.id}
                draggable={canEdit}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`border rounded-lg px-3 py-2.5 bg-white flex items-start gap-3 group transition-shadow ${
                  editingPaso?.id === paso.id ? "border-primary ring-1 ring-primary/20" : "hover:shadow-sm"
                } ${canEdit ? "cursor-grab" : ""}`}
              >
                {canEdit && (
                  <div className="text-muted-foreground/40 hover:text-muted-foreground pt-0.5 cursor-grab shrink-0">
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TIPO_COLORS[paso.tipo]}`}>
                      {TIPO_LABELS[paso.tipo]}
                    </span>
                    <span className="font-medium text-sm">{paso.nombre}</span>
                    <span className="text-xs text-muted-foreground/60">{idx + 1}</span>
                  </div>
                  {paso.descripcion && (
                    <p className="text-xs text-muted-foreground">{paso.descripcion}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {paso.sectores.map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-[10px] px-1.5 py-0">{s.nombre}</Badge>
                    ))}
                    {paso.instructivo ? (
                      <span className="text-xs text-blue-600 flex items-center gap-1">
                        <FileText className="h-3 w-3" />{paso.instructivo.nombre}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">Sin instructivo</span>
                    )}
                    {paso.tipo === "decision" && (paso.rama_si != null || paso.rama_no != null) && (
                      <span className="text-xs text-amber-600">
                        Sí → {paso.rama_si ?? "?"} / No → {paso.rama_no ?? "?"}
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPaso(paso)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button size="icon" variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeletePaso(paso)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Inline add form */}
            {canEdit && (
              addingPaso ? (
                <div className="border-2 border-dashed border-primary/30 rounded-lg p-3 bg-primary/5 space-y-2">
                  <div className="flex gap-2">
                    <Select value={newPasoTipo} onValueChange={setNewPasoTipo}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inicio">Inicio</SelectItem>
                        <SelectItem value="proceso">Proceso</SelectItem>
                        <SelectItem value="decision">Decisión</SelectItem>
                        <SelectItem value="fin">Fin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8 text-sm flex-1"
                      placeholder="Nombre del paso..."
                      value={newPasoNombre}
                      onChange={(e) => setNewPasoNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddPaso();
                        if (e.key === "Escape") { setAddingPaso(false); setNewPasoNombre(""); }
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={handleAddPaso}
                      disabled={savingNewPaso || !newPasoNombre.trim()}>
                      {savingNewPaso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Agregar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => { setAddingPaso(false); setNewPasoNombre(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full border-dashed text-muted-foreground h-9"
                  onClick={() => setAddingPaso(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />Agregar paso
                </Button>
              )
            )}
          </div>
        </div>

        {/* Right panel: edit paso */}
        {editingPaso && canEdit && (
          <div className="w-80 border-l bg-white flex flex-col overflow-hidden shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <span className="font-semibold text-sm">Editar paso</span>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setEditingPaso(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={editForm.tipo}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inicio">Inicio</SelectItem>
                    <SelectItem value="proceso">Proceso</SelectItem>
                    <SelectItem value="decision">Decisión</SelectItem>
                    <SelectItem value="fin">Fin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descripción</label>
                <textarea
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
                  value={editForm.descripcion}
                  onChange={(e) => setEditForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción opcional..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Sectores participantes</label>
                <div className="mt-1 border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
                  {allSectores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={editForm.sectores.includes(s.id)}
                        onChange={(e) => {
                          setEditForm((f) => ({
                            ...f,
                            sectores: e.target.checked
                              ? [...f.sectores, s.id]
                              : f.sectores.filter((id) => id !== s.id),
                          }));
                        }}
                      />
                      {s.nombre}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Instructivo vinculado</label>
                <Select value={editForm.instructivo_id}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, instructivo_id: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Sin instructivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin instructivo</SelectItem>
                    {sectorInstructivos.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.nombre} (v{inst.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editForm.tipo === "decision" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Ramas de decisión (nro. de paso)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Sí →</label>
                      <Input className="mt-1 h-8 text-sm" type="number" min="0"
                        value={editForm.rama_si}
                        onChange={(e) => setEditForm((f) => ({ ...f, rama_si: e.target.value }))}
                        placeholder="nro."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">No →</label>
                      <Input className="mt-1 h-8 text-sm" type="number" min="0"
                        value={editForm.rama_no}
                        onChange={(e) => setEditForm((f) => ({ ...f, rama_no: e.target.value }))}
                        placeholder="nro."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t px-4 py-3 flex gap-2 shrink-0">
              <Button className="flex-1 h-8 text-sm" onClick={handleSaveEdit}
                disabled={savingEdit || !editForm.nombre.trim()}>
                {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Guardar
              </Button>
              <Button variant="outline" className="h-8 text-sm" onClick={() => setEditingPaso(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
