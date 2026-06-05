"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls,
  addEdge, applyNodeChanges, applyEdgeChanges,
  Handle, Position, MarkerType,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, X, Loader2, Trash2, Circle, Square, Diamond, LayoutGrid, FileText, ExternalLink, Upload, History, RotateCcw } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const LANE_WIDTH = 230;
const LANE_HEADER = 48;

// ─── Data types ────────────────────────────────────────────────────────────────

export interface Sector { id: string; nombre: string }
export interface Instructivo { id: string; nombre: string; version: number; url_archivo?: string | null }

export interface NodeData {
  nombre: string;
  tipo: "inicio" | "proceso" | "decision" | "fin";
  descripcion?: string;
  sectores: string[];
  instructivo_id: string | null;
  lane_sector_id?: string;
  sector_nombres?: string[];
  instructivo_nombre?: string;
  [key: string]: unknown;
}

// ─── Lane background node ─────────────────────────────────────────────────────

function LaneNode({ data }: { data: { nombre: string; height: number } }) {
  return (
    <div
      style={{ width: LANE_WIDTH, height: data.height, pointerEvents: "none" }}
      className="border-r border-slate-200 select-none"
    >
      <div
        style={{ height: LANE_HEADER }}
        className="border-b border-slate-200 bg-slate-100 flex items-center justify-center px-3"
      >
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide text-center leading-tight">
          {data.nombre}
        </span>
      </div>
      <div className="bg-white/70" style={{ height: data.height - LANE_HEADER }} />
    </div>
  );
}

// ─── Process node shapes ──────────────────────────────────────────────────────

function InicioFinNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <div className={`px-5 py-2 rounded-full border-2 text-sm font-semibold text-center min-w-[110px] select-none
      ${data.tipo === "inicio" ? "bg-green-50 border-green-400 text-green-800" : "bg-slate-100 border-slate-400 text-slate-700"}
      ${selected ? "ring-2 ring-primary ring-offset-1" : ""}`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400" />
      {data.nombre}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
}

function ProcesoNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded-lg border-2 text-sm min-w-[140px] max-w-[200px] select-none bg-white
      ${selected ? "border-primary ring-2 ring-primary/20" : "border-blue-300"} shadow-sm`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-blue-400" />
      <Handle type="target" position={Position.Left} id="left-in" className="!w-2 !h-2 !bg-blue-400" />
      <Handle type="target" position={Position.Right} id="right-in" className="!w-2 !h-2 !bg-blue-400" />
      <p className="font-medium text-slate-800 text-center leading-tight">{data.nombre}</p>
      {data.sector_nombres && data.sector_nombres.length > 0 && (
        <div className="flex flex-wrap gap-0.5 justify-center mt-1.5">
          {data.sector_nombres.map((s, i) => (
            <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{s}</span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-400" />
      <Handle type="source" position={Position.Right} id="right-out" className="!w-2 !h-2 !bg-blue-400" />
      <Handle type="source" position={Position.Left} id="left-out" className="!w-2 !h-2 !bg-blue-400" />
    </div>
  );
}

function DecisionNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <div style={{ width: 130, height: 90 }} className="relative select-none flex items-center justify-center">
      <Handle type="target" position={Position.Top} style={{ top: 0 }} className="!w-2 !h-2 !bg-amber-500" />
      <svg width="130" height="90" className="absolute inset-0">
        <polygon
          points="65,4 126,45 65,86 4,45"
          fill={selected ? "#fef9c3" : "#fffbeb"}
          stroke={selected ? "#d97706" : "#f59e0b"}
          strokeWidth={selected ? 2.5 : 2}
        />
      </svg>
      <div className="relative z-10 text-center px-6">
        <p className="text-[11px] font-semibold text-amber-900 leading-tight">{data.nombre}</p>
      </div>
      <Handle type="source" position={Position.Right} id="si" style={{ right: -4, top: "50%" }}
        className="!w-2 !h-2 !bg-green-500" />
      <Handle type="source" position={Position.Left} id="no" style={{ left: -4, top: "50%" }}
        className="!w-2 !h-2 !bg-red-400" />
      <Handle type="source" position={Position.Bottom} id="default" style={{ bottom: -4 }}
        className="!w-2 !h-2 !bg-amber-500" />
    </div>
  );
}

const nodeTypes = {
  lane: LaneNode,
  inicio: InicioFinNode,
  proceso: ProcesoNode,
  decision: DecisionNode,
  fin: InicioFinNode,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function laneX(index: number): number {
  return index * LANE_WIDTH + LANE_WIDTH / 2 - 65;
}

function makeNode(id: string, tipo: NodeData["tipo"], nombre: string, x: number, y: number): Node<NodeData> {
  return {
    id, type: tipo, position: { x, y },
    data: { nombre, tipo, sectores: [], instructivo_id: null, sector_nombres: [] },
  };
}

export function pasosToFlow(pasos: Array<{
  id: string; nombre: string; tipo: string; orden: number;
  sectores?: Sector[]; instructivo?: { id: string; nombre: string; version: number } | null;
}>): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = pasos.map((p, i) => ({
    id: p.id,
    type: (p.tipo as NodeData["tipo"]) || "proceso",
    position: { x: 250, y: i * 140 + 40 },
    data: {
      nombre: p.nombre,
      tipo: p.tipo as NodeData["tipo"],
      sectores: p.sectores?.map((s) => s.id) ?? [],
      instructivo_id: p.instructivo?.id ?? null,
      sector_nombres: p.sectores?.map((s) => s.nombre) ?? [],
      instructivo_nombre: p.instructivo?.nombre,
    },
  }));
  const edges: Edge[] = nodes.slice(0, -1).map((n, i) => ({
    id: `e-${n.id}-${nodes[i + 1].id}`,
    source: n.id,
    target: nodes[i + 1].id,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 1.5 },
  }));
  return { nodes, edges };
}

// ─── Lanes Config Panel ───────────────────────────────────────────────────────

interface LanesConfigProps {
  allSectores: Sector[];
  lanes: string[];
  onChange: (lanes: string[]) => void;
  onClose: () => void;
}

function LanesConfigPanel({ allSectores, lanes, onChange, onClose }: LanesConfigProps) {
  const [selected, setSelected] = useState<string[]>(lanes);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : [...prev, id]
    );
  }

  return (
    <div className="w-64 border-l bg-white flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-semibold text-sm">Sectores del diagrama</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-xs text-muted-foreground mb-3">
          Seleccioná los sectores que aparecen como columnas del diagrama. El orden de la lista es el orden de las columnas.
        </p>
        <div className="space-y-0.5">
          {allSectores.map((s) => (
            <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm py-1.5 hover:bg-slate-50 px-1 rounded">
              <input type="checkbox" className="rounded"
                checked={selected.includes(s.id)}
                onChange={() => toggle(s.id)} />
              <span className="flex-1">{s.nombre}</span>
              {selected.includes(s.id) && (
                <span className="text-[10px] text-slate-400 font-medium">
                  col. {selected.indexOf(s.id) + 1}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>
      <div className="border-t px-4 py-3 flex gap-2">
        <Button className="flex-1 h-8 text-sm" onClick={() => { onChange(selected); onClose(); }}>
          Aplicar
        </Button>
        <Button variant="outline" className="h-8 text-sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─── Edit Panel ────────────────────────────────────────────────────────────────

interface PanelProps {
  node: Node<NodeData>;
  allSectores: Sector[];
  instructivos: Instructivo[];
  lanes: string[];
  flujogramaSectorId: string;
  onSave: (id: string, data: Partial<NodeData>) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}

function EditPanel({
  node, allSectores, instructivos, lanes, flujogramaSectorId,
  onSave, onClose, onDelete, canDelete,
}: PanelProps) {
  const [nombre, setNombre] = useState(node.data.nombre);
  const [tipo, setTipo] = useState(node.data.tipo);
  const [descripcion, setDescripcion] = useState(node.data.descripcion ?? "");
  const [sectores, setSectores] = useState<string[]>(node.data.sectores ?? []);
  const [instructivoId, setInstructivoId] = useState(node.data.instructivo_id ?? "__none__");
  const [laneSectorId, setLaneSectorId] = useState(node.data.lane_sector_id ?? "__none__");

  // Extra instructivos created inline (not yet in the parent list)
  const [localInstructivos, setLocalInstructivos] = useState<Instructivo[]>([]);

  // Inline create-instructivo form
  const [creatingInst, setCreatingInst] = useState(false);
  const [instNombre, setInstNombre] = useState("");
  const [instFile, setInstFile] = useState<File | null>(null);
  const [instSectores, setInstSectores] = useState<string[]>([]);
  const [instUploading, setInstUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNombre(node.data.nombre);
    setTipo(node.data.tipo);
    setDescripcion(node.data.descripcion ?? "");
    setSectores(node.data.sectores ?? []);
    setInstructivoId(node.data.instructivo_id ?? "__none__");
    setLaneSectorId(node.data.lane_sector_id ?? "__none__");
    setCreatingInst(false);
    setInstNombre("");
    setInstFile(null);
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    const sectorNombres = allSectores.filter((s) => sectores.includes(s.id)).map((s) => s.nombre);
    const allInst = [...instructivos, ...localInstructivos];
    const inst = allInst.find((i) => i.id === instructivoId);
    onSave(node.id, {
      nombre, tipo,
      descripcion: descripcion || undefined,
      sectores,
      instructivo_id: instructivoId === "__none__" ? null : instructivoId,
      lane_sector_id: laneSectorId === "__none__" ? undefined : laneSectorId,
      sector_nombres: sectorNombres,
      instructivo_nombre: inst?.nombre,
    });
    onClose();
  }

  async function handleCreateInstructivo() {
    if (!instNombre.trim()) return;
    setInstUploading(true);

    let url_archivo: string | null = null;
    let nombre_archivo: string | null = null;

    if (instFile) {
      const fd = new FormData();
      fd.append("file", instFile);
      const uploadRes = await fetch("/api/procesos/instructivos/upload", { method: "POST", body: fd });
      if (uploadRes.ok) {
        const d = await uploadRes.json();
        url_archivo = d.url;
        nombre_archivo = d.nombre_archivo;
      }
    }

    const res = await fetch("/api/procesos/instructivos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sector_id: flujogramaSectorId,
        nombre: instNombre.trim(),
        url_archivo,
        nombre_archivo,
        estado: "borrador",
      }),
    });

    if (res.ok) {
      const newInst: Instructivo = await res.json();
      setLocalInstructivos((prev) => [...prev, newInst]);
      setInstructivoId(newInst.id);
      // Sync chosen sectors back to the paso
      setSectores(instSectores);
      setCreatingInst(false);
      setInstNombre("");
      setInstFile(null);
      setInstSectores([]);
    }

    setInstUploading(false);
  }

  const activeLaneSectors = allSectores.filter((s) => lanes.includes(s.id));
  const allInstructivos = [...instructivos, ...localInstructivos];
  const linkedInst = allInstructivos.find((i) => i.id === instructivoId);

  return (
    <div className="w-72 border-l bg-white flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-semibold text-sm">Editar paso</span>
        <div className="flex items-center gap-1">
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => { onDelete(node.id); onClose(); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as NodeData["tipo"])}>
            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inicio">● Inicio</SelectItem>
              <SelectItem value="proceso">■ Proceso</SelectItem>
              <SelectItem value="decision">◆ Decisión</SelectItem>
              <SelectItem value="fin">● Fin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
          <Input className="mt-1 h-8 text-sm" value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()} />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Descripción</label>
          <textarea className="mt-1 w-full border rounded-md px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-1 focus:ring-ring"
            value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional..." />
        </div>

        {activeLaneSectors.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Columna del sector</label>
            <Select value={laneSectorId} onValueChange={setLaneSectorId}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue placeholder="Sin carril asignado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin carril</SelectItem>
                {activeLaneSectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground">Sectores participantes</label>
          <div className="mt-1 border rounded-md p-2 space-y-0.5 max-h-36 overflow-y-auto">
            {allSectores.map((s) => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                <input type="checkbox" className="rounded"
                  checked={sectores.includes(s.id)}
                  onChange={(e) => setSectores(e.target.checked
                    ? [...sectores, s.id]
                    : sectores.filter((id) => id !== s.id)
                  )} />
                {s.nombre}
              </label>
            ))}
          </div>
        </div>

        {/* ── Instructivo section ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Instructivo</label>
            {!creatingInst && (
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700"
                onClick={() => { setCreatingInst(true); setInstNombre(nombre); setInstSectores(sectores); }}>
                <Plus className="h-3 w-3 mr-1" />Crear nuevo
              </Button>
            )}
          </div>

          {/* Existing instructivo selector */}
          {!creatingInst && (
            <Select value={instructivoId} onValueChange={setInstructivoId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Sin instructivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin instructivo</SelectItem>
                {allInstructivos.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Ver link when linked */}
          {!creatingInst && linkedInst && linkedInst.url_archivo && (
            <a
              href={linkedInst.url_archivo}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
            >
              <FileText className="h-3 w-3" />
              {linkedInst.nombre}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Inline create form */}
          {creatingInst && (
            <div className="border rounded-lg p-3 space-y-3 bg-blue-50/50 border-blue-100">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nombre del instructivo *</label>
                <Input className="mt-1 h-8 text-sm" value={instNombre}
                  onChange={(e) => setInstNombre(e.target.value)}
                  placeholder="Ej: Cómo procesar una factura" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Sectores que intervienen</label>
                <div className="mt-1 border rounded-md p-2 space-y-0.5 max-h-32 overflow-y-auto bg-white">
                  {allSectores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                      <input type="checkbox" className="rounded"
                        checked={instSectores.includes(s.id)}
                        onChange={(e) => setInstSectores(e.target.checked
                          ? [...instSectores, s.id]
                          : instSectores.filter((id) => id !== s.id)
                        )} />
                      {s.nombre}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Archivo o video</label>
                <div
                  className="mt-1 border-2 border-dashed border-blue-200 rounded-md p-3 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {instFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-700">
                      <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="truncate max-w-[150px]">{instFile.name}</span>
                      <button className="text-muted-foreground hover:text-destructive ml-1"
                        onClick={(e) => { e.stopPropagation(); setInstFile(null); }}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Upload className="h-5 w-5 opacity-40" />
                      <span className="text-xs">Hacer clic para seleccionar</span>
                      <span className="text-[10px] opacity-60">PDF, Word, MP4, etc.</span>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" className="hidden"
                  onChange={(e) => setInstFile(e.target.files?.[0] ?? null)} />
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-7 text-xs"
                  onClick={handleCreateInstructivo}
                  disabled={instUploading || !instNombre.trim()}>
                  {instUploading
                    ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Creando…</>
                    : "Crear y vincular"}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => { setCreatingInst(false); setInstFile(null); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <Button className="w-full h-8 text-sm" onClick={handleSave} disabled={!nombre.trim()}>
          Aplicar cambios
        </Button>
      </div>
    </div>
  );
}

// ─── Historial Panel ─────────────────────────────────────────────────────────

interface HistorialEntry {
  id: string;
  fecha: string;
  resumen: string | null;
  flow_data: { nodes: Node<NodeData>[]; edges: Edge[] };
  guardado_por: { nombre: string } | { nombre: string }[] | null;
}

interface HistorialPanelProps {
  flujogramaId: string;
  onRestore: (nodes: Node<NodeData>[], edges: Edge[]) => void;
  onClose: () => void;
}

function HistorialPanel({ flujogramaId, onRestore, onClose }: HistorialPanelProps) {
  const [entries, setEntries] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/procesos/flujogramas/${flujogramaId}/historial`)
      .then((r) => r.json())
      .then((d) => { setEntries(Array.isArray(d) ? d : []); setLoading(false); });
  }, [flujogramaId]);

  function formatFecha(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  function getUsuario(entry: HistorialEntry) {
    const u = Array.isArray(entry.guardado_por) ? entry.guardado_por[0] : entry.guardado_por;
    return u?.nombre ?? "—";
  }

  return (
    <div className="w-72 border-l bg-white flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Historial</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground gap-2">
            <History className="h-8 w-8 opacity-20" />
            <p className="text-xs">Sin historial aún. Guardá el diagrama para crear la primera versión.</p>
          </div>
        ) : (
          <div className="divide-y">
            {entries.map((entry, i) => (
              <div key={entry.id} className="px-4 py-3 hover:bg-slate-50 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700">{formatFecha(entry.fecha)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{getUsuario(entry)}</p>
                    {entry.resumen && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">{entry.resumen}</p>
                    )}
                  </div>
                  {i > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] px-2 opacity-0 group-hover:opacity-100 shrink-0 text-blue-600 hover:text-blue-700"
                      onClick={() => {
                        if (confirm(`¿Restaurar a esta versión del ${formatFecha(entry.fecha)}? Los cambios sin guardar se perderán.`)) {
                          onRestore(entry.flow_data.nodes ?? [], entry.flow_data.edges ?? []);
                          onClose();
                        }
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />Restaurar
                    </Button>
                  )}
                  {i === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium shrink-0">actual</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main editor ───────────────────────────────────────────────────────────────

interface Props {
  flujogramaId: string;
  flujogramaSectorId: string;
  initialNodes: Node<NodeData>[];
  initialEdges: Edge[];
  initialLanes?: string[];
  allSectores: Sector[];
  instructivos: Instructivo[];
  canEdit: boolean;
  isAdmin: boolean;
  onSaved?: () => void;
}

export function FlujogramaEditor({
  flujogramaId, flujogramaSectorId, initialNodes, initialEdges, initialLanes,
  allSectores, instructivos, canEdit, isAdmin, onSaved,
}: Props) {
  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [lanes, setLanes] = useState<string[]>(initialLanes ?? []);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [showLanesConfig, setShowLanesConfig] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [addLaneSectorId, setAddLaneSectorId] = useState<string>("__none__");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const idCounter = useRef(0);

  // Dynamic lane height: enough to cover all nodes
  const laneHeight = Math.max(
    nodes.reduce((max, n) => Math.max(max, n.position.y + 250), LANE_HEADER + 400),
    600
  );

  // Build lane background nodes (derived, not stored in `nodes`)
  const laneNodes: Node[] = lanes.map((sectorId, index) => {
    const sector = allSectores.find((s) => s.id === sectorId);
    return {
      id: `__lane__${sectorId}`,
      type: "lane",
      position: { x: index * LANE_WIDTH, y: 0 },
      data: { nombre: sector?.nombre ?? sectorId, height: laneHeight },
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
      zIndex: -1,
    };
  });

  const allNodes = [...laneNodes, ...nodes];

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const processChanges = changes.filter((c) => {
      const id = (c as { id?: string }).id ?? "";
      return !id.startsWith("__lane__");
    });
    if (processChanges.length === 0) return;
    setNodes((nds) => applyNodeChanges(processChanges, nds) as Node<NodeData>[]);
    const moved = processChanges.some((c) => c.type === "position" || c.type === "remove");
    if (moved) setDirty(true);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    setDirty(true);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    const edge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 1.5 },
      label: connection.sourceHandle === "si" ? "Sí"
        : connection.sourceHandle === "no" ? "No"
        : undefined,
    };
    setEdges((eds) => addEdge(edge, eds));
    setDirty(true);
  }, []);

  function addNode(tipo: NodeData["tipo"]) {
    idCounter.current += 1;
    const id = crypto.randomUUID();
    const nombre = tipo === "inicio" ? "Inicio"
      : tipo === "fin" ? "Fin"
      : tipo === "decision" ? "¿Decisión?"
      : `Paso ${idCounter.current}`;

    const laneIndex = lanes.indexOf(addLaneSectorId);
    let x = 250;
    let y = 80;

    if (laneIndex >= 0) {
      x = laneX(laneIndex);
      const nodesInLane = nodes.filter((n) => n.data.lane_sector_id === addLaneSectorId);
      y = nodesInLane.length > 0
        ? Math.max(...nodesInLane.map((n) => n.position.y)) + 160
        : LANE_HEADER + 40;
    } else if (nodes.length > 0) {
      y = Math.max(...nodes.map((n) => n.position.y)) + 160;
    }

    const newNode: Node<NodeData> = {
      ...makeNode(id, tipo, nombre, x, y),
      data: {
        ...makeNode(id, tipo, nombre, x, y).data,
        lane_sector_id: laneIndex >= 0 ? addLaneSectorId : undefined,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setDirty(true);
    setSelectedNode(newNode);
  }

  function updateNodeData(id: string, data: Partial<NodeData>) {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== id) return n;
      const newData = { ...n.data, ...data };
      let pos = n.position;
      // If lane changed, snap x to that lane's center
      if (data.lane_sector_id !== undefined && data.lane_sector_id !== n.data.lane_sector_id) {
        const laneIdx = lanes.indexOf(data.lane_sector_id ?? "");
        if (laneIdx >= 0) pos = { x: laneX(laneIdx), y: n.position.y };
      }
      return { ...n, type: newData.tipo, data: newData, position: pos };
    }));
    setDirty(true);
  }

  function deleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setDirty(true);
  }

  function restoreSnapshot(restoredNodes: Node<NodeData>[], restoredEdges: Edge[]) {
    setNodes(restoredNodes);
    setEdges(restoredEdges);
    setSelectedNode(null);
    setDirty(true);
  }

  function handleLanesChange(newLanes: string[]) {
    setLanes(newLanes);
    setDirty(true);
    if (!newLanes.includes(addLaneSectorId)) setAddLaneSectorId("__none__");
  }

  async function handleSave() {
    setSaving(true);
    const flow_data = { nodes, edges, lanes };
    const nodesPayload = nodes.map((n, i) => ({
      id: n.id,
      nombre: n.data.nombre,
      tipo: n.data.tipo,
      descripcion: n.data.descripcion || null,
      sectores: n.data.sectores ?? [],
      instructivo_id: n.data.instructivo_id ?? null,
      orden: i,
    }));

    const res = await fetch(`/api/procesos/flujogramas/${flujogramaId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_data, nodes: nodesPayload }),
    });

    setSaving(false);
    if (res.ok) { setDirty(false); onSaved?.(); }
  }


  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setShowLanesConfig(false);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if ((node.id as string).startsWith("__lane__")) return;
    if (canEdit) { setSelectedNode(node as Node<NodeData>); setShowHistorial(false); setShowLanesConfig(false); }
  }, [canEdit]);

  const activeLaneSectors = allSectores.filter((s) => lanes.includes(s.id));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b bg-white px-4 py-2 flex items-center gap-2 shrink-0 flex-wrap">
        {/* Sector button always visible */}
        <Button
          size="sm"
          variant={lanes.length > 0 ? "secondary" : "outline"}
          className="h-7 text-xs gap-1.5"
          onClick={() => { if (canEdit) { setShowLanesConfig((v) => !v); setShowHistorial(false); setSelectedNode(null); } }}
          disabled={!canEdit}
        >
          <LayoutGrid className="h-3 w-3" />
          {lanes.length > 0 ? `Sectores (${lanes.length})` : "Agregar sector"}
        </Button>

        {canEdit ? (
          <>

            <div className="w-px h-4 bg-border mx-0.5" />

            {lanes.length > 0 && (
              <Select value={addLaneSectorId} onValueChange={setAddLaneSectorId}>
                <SelectTrigger className="h-7 text-xs w-40">
                  <SelectValue placeholder="En columna…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin columna</SelectItem>
                  {activeLaneSectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <span className="text-xs text-muted-foreground font-medium">Agregar:</span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => addNode("inicio")}>
              <Circle className="h-3 w-3 fill-green-400 text-green-600" />Inicio
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => addNode("proceso")}>
              <Square className="h-3 w-3 fill-blue-100 text-blue-600" />Proceso
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => addNode("decision")}>
              <Diamond className="h-3 w-3 fill-amber-100 text-amber-600" />Decisión
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => addNode("fin")}>
              <Circle className="h-3 w-3 fill-slate-300 text-slate-500" />Fin
            </Button>

            <div className="flex-1" />

            <Button size="sm" onClick={handleSave} disabled={saving || !dirty} className={dirty ? "" : "opacity-50"}>
              {saving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Guardando…</>
                : <><Save className="h-3.5 w-3.5 mr-1.5" />Guardar</>}
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Vista de solo lectura</span>
        )}

        {/* Historial button — always visible */}
        <Button
          size="sm" variant={showHistorial ? "secondary" : "ghost"}
          className="h-7 text-xs gap-1.5 ml-1"
          onClick={() => { setShowHistorial((v) => !v); setShowLanesConfig(false); setSelectedNode(null); }}
        >
          <History className="h-3 w-3" />Historial
        </Button>
      </div>

      {/* Canvas + side panels */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative" style={{ background: lanes.length > 0 ? "#f1f5f9" : "#f8fafc" }}>
          <ReactFlow
            nodes={allNodes}
            edges={edges}
            onNodesChange={canEdit ? onNodesChange : undefined}
            onEdgesChange={canEdit ? onEdgesChange : undefined}
            onConnect={canEdit ? onConnect : undefined}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            deleteKeyCode={canEdit ? "Delete" : null}
            edgesReconnectable={canEdit}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable={true}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { strokeWidth: 1.5, stroke: "#94a3b8" },
            }}
          >
            <Background color="#e2e8f0" gap={20} />
            <Controls />
          </ReactFlow>

          {nodes.length === 0 && canEdit && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Plus className="h-10 w-10 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground/50">
                {lanes.length > 0
                  ? "Elegí una columna y hacé clic en Inicio / Proceso / Decisión / Fin"
                  : "Usá los botones de arriba para agregar pasos"}
              </p>
            </div>
          )}
        </div>

        {showLanesConfig && canEdit && (
          <LanesConfigPanel
            allSectores={allSectores}
            lanes={lanes}
            onChange={handleLanesChange}
            onClose={() => setShowLanesConfig(false)}
          />
        )}

        {showHistorial && (
          <HistorialPanel
            flujogramaId={flujogramaId}
            onRestore={restoreSnapshot}
            onClose={() => setShowHistorial(false)}
          />
        )}

        {selectedNode && !showLanesConfig && !showHistorial && canEdit && (
          <EditPanel
            node={selectedNode}
            allSectores={allSectores}
            instructivos={instructivos}
            lanes={lanes}
            flujogramaSectorId={flujogramaSectorId}
            onSave={(id, data) => {
              updateNodeData(id, data);
              setSelectedNode(null);
            }}
            onClose={() => setSelectedNode(null)}
            onDelete={deleteNode}
            canDelete={isAdmin}
          />
        )}
      </div>
    </div>
  );
}
