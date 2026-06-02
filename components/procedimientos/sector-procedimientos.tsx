"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, Pencil, Trash2, Upload, Download, FileText, History,
} from "lucide-react";
import { formatFecha } from "@/lib/utils/format";

interface Revision {
  id: string;
  procedimiento_id: string;
  version: number;
  fecha_revision: string;
  fecha_vencimiento: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  observaciones: string | null;
  revisado_por: string | null;
  revisado_por_user?: { nombre: string } | null;
  created_at: string;
}

interface Procedimiento {
  id: string;
  sector_id: string;
  nombre: string;
  descripcion: string | null;
  responsable_id: string | null;
  activo: boolean;
  responsable?: { id: string; nombre: string } | null;
  ultima_revision: Revision | null;
}

interface Usuario {
  id: string;
  nombre: string;
}

interface Props {
  sector: { id: string; nombre: string };
  procedimientosIniciales: Procedimiento[];
  usuarios: Usuario[];
  canEdit: boolean;
}

function semaforo(vencimiento: string | null): "verde" | "amarillo" | "rojo" | "sin" {
  if (!vencimiento) return "sin";
  const diff = Math.floor(
    (new Date(vencimiento + "T00:00:00").getTime() - Date.now()) / 86400000
  );
  if (diff < 0) return "rojo";
  if (diff <= 30) return "amarillo";
  return "verde";
}

const DOT_COLOR = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
  sin: "bg-gray-300",
};

const STATUS_LABEL: Record<string, string> = {
  verde: "Vigente",
  amarillo: "Por vencer",
  rojo: "Vencido",
  sin: "Sin revisión",
};

const STATUS_TEXT: Record<string, string> = {
  verde: "text-green-700",
  amarillo: "text-yellow-700",
  rojo: "text-red-700",
  sin: "text-gray-500",
};

const STATUS_BADGE: Record<string, string> = {
  verde: "border-green-300 text-green-700",
  amarillo: "border-yellow-300 text-yellow-700",
  rojo: "border-red-300 text-red-700",
  sin: "border-gray-300 text-gray-500",
};

const EMPTY_PROC = { nombre: "", descripcion: "", responsable_id: "" };

function addOneYear(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function SectorProcedimientos({ sector, procedimientosIniciales, usuarios, canEdit }: Props) {
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>(procedimientosIniciales);
  const [selectedProc, setSelectedProc] = useState<Procedimiento | null>(null);
  const [revisionesMap, setRevisionesMap] = useState<Record<string, Revision[]>>({});
  const [loadingRevs, setLoadingRevs] = useState(false);

  // Procedimiento dialog
  const [procDialog, setProcDialog] = useState(false);
  const [editingProc, setEditingProc] = useState<Procedimiento | null>(null);
  const [procForm, setProcForm] = useState(EMPTY_PROC);
  const [savingProc, setSavingProc] = useState(false);

  // Revision dialog
  const [revDialog, setRevDialog] = useState(false);
  const [revFechaRevision, setRevFechaRevision] = useState("");
  const [revFechaVencimiento, setRevFechaVencimiento] = useState("");
  const [revObservaciones, setRevObservaciones] = useState("");
  const [savingRev, setSavingRev] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; nombre: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newRevForProcId = useRef<string | null>(null);

  async function loadRevisiones(procId: string) {
    if (revisionesMap[procId]) return;
    setLoadingRevs(true);
    const res = await fetch(`/api/procedimientos/${procId}/revisiones`);
    const data = await res.json();
    setRevisionesMap((prev) => ({ ...prev, [procId]: data }));
    setLoadingRevs(false);
  }

  async function handleSelectProc(proc: Procedimiento) {
    if (selectedProc?.id === proc.id) {
      setSelectedProc(null);
      return;
    }
    setSelectedProc(proc);
    await loadRevisiones(proc.id);
  }

  function openNewProc() {
    setEditingProc(null);
    setProcForm(EMPTY_PROC);
    setProcDialog(true);
  }

  function openEditProc(proc: Procedimiento) {
    setEditingProc(proc);
    setProcForm({
      nombre: proc.nombre,
      descripcion: proc.descripcion ?? "",
      responsable_id: proc.responsable_id ?? "",
    });
    setProcDialog(true);
  }

  async function handleSaveProc() {
    if (!procForm.nombre.trim()) return;
    setSavingProc(true);
    try {
      if (editingProc) {
        const res = await fetch(`/api/procedimientos/${editingProc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: procForm.nombre,
            descripcion: procForm.descripcion || null,
            responsable_id: procForm.responsable_id || null,
          }),
        });
        const updated = await res.json();
        const responsable = usuarios.find((u) => u.id === procForm.responsable_id) ?? null;
        setProcedimientos((prev) =>
          prev.map((p) =>
            p.id === editingProc.id
              ? { ...p, ...updated, responsable, ultima_revision: p.ultima_revision }
              : p
          )
        );
        if (selectedProc?.id === editingProc.id) {
          setSelectedProc((prev) =>
            prev ? { ...prev, ...updated, responsable, ultima_revision: prev.ultima_revision } : null
          );
        }
      } else {
        const res = await fetch("/api/procedimientos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: procForm.nombre,
            descripcion: procForm.descripcion || null,
            sector_id: sector.id,
            responsable_id: procForm.responsable_id || null,
          }),
        });
        const created = await res.json();
        const responsable = usuarios.find((u) => u.id === procForm.responsable_id) ?? null;
        setProcedimientos((prev) => [...prev, { ...created, responsable, ultima_revision: null }]);
      }
      setProcDialog(false);
    } finally {
      setSavingProc(false);
    }
  }

  async function handleDeleteProc(proc: Procedimiento, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${proc.nombre}"? Esta acción no se puede deshacer.`)) return;
    await fetch(`/api/procedimientos/${proc.id}`, { method: "DELETE" });
    setProcedimientos((prev) => prev.filter((p) => p.id !== proc.id));
    if (selectedProc?.id === proc.id) setSelectedProc(null);
  }

  function openNewRevision(procId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    newRevForProcId.current = procId;
    const today = new Date().toISOString().slice(0, 10);
    setRevFechaRevision(today);
    setRevFechaVencimiento(addOneYear(today));
    setRevObservaciones("");
    setUploadedFile(null);
    setRevDialog(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("procedimiento_id", newRevForProcId.current ?? "general");
    const res = await fetch("/api/procedimientos/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setUploadedFile({ url: data.url, nombre: data.nombre });
    setUploadingFile(false);
  }

  async function handleSaveRevision() {
    if (!revFechaRevision || !revFechaVencimiento) return;
    const procId = newRevForProcId.current;
    if (!procId) return;
    setSavingRev(true);
    try {
      const res = await fetch(`/api/procedimientos/${procId}/revisiones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_revision: revFechaRevision,
          fecha_vencimiento: revFechaVencimiento,
          archivo_url: uploadedFile?.url ?? null,
          archivo_nombre: uploadedFile?.nombre ?? null,
          observaciones: revObservaciones || null,
        }),
      });
      const created = await res.json();
      setRevisionesMap((prev) => ({
        ...prev,
        [procId]: [created, ...(prev[procId] ?? [])],
      }));
      setProcedimientos((prev) =>
        prev.map((p) => (p.id === procId ? { ...p, ultima_revision: created } : p))
      );
      if (selectedProc?.id === procId) {
        setSelectedProc((prev) => (prev ? { ...prev, ultima_revision: created } : null));
      }
      setRevDialog(false);
    } finally {
      setSavingRev(false);
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Lista principal */}
      <div className={`flex flex-col ${selectedProc ? "w-[55%] border-r" : "w-full"} overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
          <span className="text-sm text-muted-foreground">
            {procedimientos.length} procedimiento{procedimientos.length !== 1 ? "s" : ""}
          </span>
          {canEdit && (
            <Button size="sm" onClick={openNewProc}>
              <Plus className="h-4 w-4 mr-1.5" /> Nuevo procedimiento
            </Button>
          )}
        </div>

        {procedimientos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="h-8 w-8 opacity-30" />
            <p className="text-sm">No hay procedimientos en este sector.</p>
            {canEdit && (
              <p className="text-xs">Hacé clic en &quot;Nuevo procedimiento&quot; para agregar el primero.</p>
            )}
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Responsable</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Última revisión</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Vencimiento</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Estado</th>
                  {canEdit && <th className="px-4 py-2.5 w-36"></th>}
                </tr>
              </thead>
              <tbody>
                {procedimientos.map((proc) => {
                  const sem = semaforo(proc.ultima_revision?.fecha_vencimiento ?? null);
                  const isSelected = selectedProc?.id === proc.id;
                  return (
                    <tr
                      key={proc.id}
                      onClick={() => handleSelectProc(proc)}
                      className={`border-b last:border-0 cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLOR[sem]}`} />
                          <span className="font-medium">{proc.nombre}</span>
                        </div>
                        {proc.descripcion && (
                          <p className="text-xs text-muted-foreground mt-0.5 ml-4 line-clamp-1">
                            {proc.descripcion}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {proc.responsable?.nombre ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {proc.ultima_revision ? formatFecha(proc.ultima_revision.fecha_revision) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={sem === "rojo" ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {proc.ultima_revision ? formatFecha(proc.ultima_revision.fecha_vencimiento) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${STATUS_TEXT[sem]}`}>
                          {STATUS_LABEL[sem]}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => openNewRevision(proc.id, e)}
                            >
                              <Upload className="h-3 w-3 mr-1" /> Revisión
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); openEditProc(proc); }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => handleDeleteProc(proc, e)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel de detalle */}
      {selectedProc && (
        <div className="w-[45%] flex flex-col overflow-hidden bg-white">
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
            <div>
              <p className="font-semibold text-sm">{selectedProc.nombre}</p>
              {selectedProc.responsable && (
                <p className="text-xs text-muted-foreground">{selectedProc.responsable.nombre}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button size="sm" onClick={() => openNewRevision(selectedProc.id)}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Nueva revisión
                </Button>
              )}
              <Button
                variant="ghost" size="sm"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => setSelectedProc(null)}
              >
                ✕
              </Button>
            </div>
          </div>

          {selectedProc.descripcion && (
            <p className="px-5 py-2 text-xs text-muted-foreground border-b shrink-0">
              {selectedProc.descripcion}
            </p>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Historial de revisiones</span>
            </div>

            {loadingRevs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !revisionesMap[selectedProc.id]?.length ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sin revisiones registradas</p>
            ) : (
              <div className="space-y-2">
                {(revisionesMap[selectedProc.id] ?? []).map((rev, idx) => {
                  const sem = semaforo(rev.fecha_vencimiento);
                  const isLatest = idx === 0;
                  return (
                    <div
                      key={rev.id}
                      className={`rounded-lg border p-3 ${
                        isLatest ? "border-primary/30 bg-primary/5" : "bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono">v{rev.version}</Badge>
                          {isLatest && (
                            <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[sem]}`}>
                              {STATUS_LABEL[sem]}
                            </Badge>
                          )}
                        </div>
                        {rev.archivo_url && (
                          <a href={rev.archivo_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">
                              <Download className="h-3 w-3 mr-1" /> Descargar
                            </Button>
                          </a>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div>
                          <span className="text-muted-foreground">Revisado: </span>
                          {formatFecha(rev.fecha_revision)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vence: </span>
                          <span className={sem === "rojo" ? "text-red-600 font-medium" : ""}>
                            {formatFecha(rev.fecha_vencimiento)}
                          </span>
                        </div>
                        {rev.revisado_por_user && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Por: </span>
                            {rev.revisado_por_user.nombre}
                          </div>
                        )}
                        {rev.archivo_nombre && (
                          <div className="col-span-2 truncate">
                            <span className="text-muted-foreground">Archivo: </span>
                            {rev.archivo_nombre}
                          </div>
                        )}
                        {rev.observaciones && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Obs: </span>
                            {rev.observaciones}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialog: Procedimiento */}
      <Dialog open={procDialog} onOpenChange={setProcDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProc ? "Editar procedimiento" : "Nuevo procedimiento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                className="mt-1"
                value={procForm.nombre}
                onChange={(e) => setProcForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Manual de calidad"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input
                className="mt-1"
                value={procForm.descripcion}
                onChange={(e) => setProcForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Descripción breve (opcional)"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Responsable</label>
              <Select
                value={procForm.responsable_id || "none"}
                onValueChange={(v) => setProcForm((p) => ({ ...p, responsable_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sin responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin responsable</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProcDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveProc} disabled={savingProc || !procForm.nombre.trim()}>
              {savingProc ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Revisión */}
      <Dialog open={revDialog} onOpenChange={setRevDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva revisión</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Fecha de revisión *</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={revFechaRevision}
                  onChange={(e) => {
                    setRevFechaRevision(e.target.value);
                    setRevFechaVencimiento(addOneYear(e.target.value));
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Fecha de vencimiento *</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={revFechaVencimiento}
                  onChange={(e) => setRevFechaVencimiento(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Observaciones</label>
              <Input
                className="mt-1"
                value={revObservaciones}
                onChange={(e) => setRevObservaciones(e.target.value)}
                placeholder="Cambios realizados, notas..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Archivo (PDF, Word, Excel...)</label>
              <div className="mt-1 flex gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline" size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                >
                  {uploadingFile
                    ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    : <Upload className="h-4 w-4 mr-1.5" />
                  }
                  {uploadingFile ? "Subiendo..." : "Seleccionar archivo"}
                </Button>
                {uploadedFile && (
                  <span className="text-xs text-green-600 truncate max-w-[160px]">
                    {uploadedFile.nombre}
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveRevision}
              disabled={savingRev || !revFechaRevision || !revFechaVencimiento || uploadingFile}
            >
              {savingRev ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar revisión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
