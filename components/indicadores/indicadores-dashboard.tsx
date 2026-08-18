"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Check, X, Minus, ArrowUpDown, ArrowUp, ArrowDown, Search, Pencil } from "lucide-react";
import { Usuario } from "@/types/database";

interface Registro { id: string; indicador_id: string; anio: number; mes: number | null; valor: string; cumple: boolean | null; comentario: string | null; cargado_por: string | null; }
interface Indicador { id: string; sector: string; nombre: string; objetivo_estrategico: string; formula: string | null; responsable_id: string | null; frecuencia: string; meta_valor: string | null; meta_condicion: string | null; meta_unidad: string | null; orden: number; activo: boolean; responsable?: { id: string; nombre: string; email: string } | null; registros: Registro[]; }
interface UsuarioBasic { id: string; nombre: string; email: string; rol: string; }
interface Props { indicadores: Indicador[]; usuario: Usuario; usuarios: UsuarioBasic[]; }

const MESES_CORTOS = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
const MESES_NOMBRES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

interface ModalState { open: boolean; indicadorId: string; indicadorNombre: string; metaCondicion: string | null; metaValor: string | null; frecuencia: string; }

function getRegistro(registros: Registro[], mes: number | null, anio: number): Registro | undefined {
  if (mes === null) return registros.find((r) => r.anio === anio && r.mes === null);
  return registros.find((r) => r.anio === anio && r.mes === mes);
}

type EstadoVenc = "ok" | "vencido";
function calcularEstado(ind: Indicador, hoy: Date): EstadoVenc {
  const anio = hoy.getFullYear(); const mes = hoy.getMonth() + 1;
  if (ind.frecuencia === "anual") { const tiene = ind.registros.some((r) => r.anio === anio && r.mes === null); return tiene ? "ok" : "vencido"; }
  const mesPrevio = mes === 1 ? 12 : mes - 1; const anioPrevio = mes === 1 ? anio - 1 : anio;
  const tienePrevio = ind.registros.some((r) => r.anio === anioPrevio && r.mes === mesPrevio);
  return tienePrevio ? "ok" : "vencido";
}

function EstadoBadge({ estado }: { estado: EstadoVenc }) {
  const cfg = { ok: { label: "Al día", cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-400" }, vencido: { label: "Vencido", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-400" } }[estado];
  return <div className={cn("inline-flex items-center gap-1 border rounded px-1.5 py-0.5 text-[10px] font-medium", cfg.cls)}><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />{cfg.label}</div>;
}

function DataCell({ registro, canInput, onAdd }: { registro: Registro | undefined; canInput: boolean; onAdd: () => void; }) {
  if (registro) {
    const bgClass = registro.cumple === true ? "bg-green-50 text-green-800" : registro.cumple === false ? "bg-red-50 text-red-800" : "bg-slate-50 text-slate-600";
    const displayVal = registro.valor.length > 8 ? registro.valor.slice(0, 8) + "…" : registro.valor;
    if (canInput) {
      return (
        <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className={cn("w-full text-center text-xs font-medium px-1 py-1 rounded min-h-[28px] flex items-center justify-center hover:opacity-80 transition-opacity", bgClass)} title={registro.valor + (registro.comentario ? " · " + registro.comentario : "") + " (clic para editar)"}>
          {displayVal}
        </button>
      );
    }
    return <div className={cn("text-center text-xs font-medium px-1 py-1 rounded min-h-[28px] flex items-center justify-center", bgClass)} title={registro.valor + (registro.comentario ? " · " + registro.comentario : "")}>{displayVal}</div>;
  }
  if (canInput) return <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="w-full text-center text-xs text-primary hover:bg-primary/10 rounded py-1 min-h-[28px] flex items-center justify-center transition-colors" title="Cargar dato"><Plus className="h-3 w-3" /></button>;
  return <div className="text-center text-xs text-slate-300 min-h-[28px] flex items-center justify-center">—</div>;
}

const EMPTY_NUEVO = { nombre: "", sector: "", objetivo_estrategico: "", formula: "", frecuencia: "mensual", meta_condicion: "", meta_valor: "", meta_unidad: "", responsable_id: "" };

export function IndicadoresDashboard({ indicadores, usuario, usuarios }: Props) {
  const router = useRouter();
  const hoy = new Date(); const currentYear = hoy.getFullYear(); const currentMonth = hoy.getMonth() + 1;
  const isAdmin = usuario.rol === "admin";
  const canDataEntry = isAdmin || usuario.rol === "editor";
  const [activeResp, setActiveResp] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);

  const vencidosPorResp: Record<string, number> = {}; let vencidosTodos = 0;
  for (const ind of indicadores) { if (calcularEstado(ind, hoy) === "vencido") { if (ind.responsable_id) vencidosPorResp[ind.responsable_id] = (vencidosPorResp[ind.responsable_id] ?? 0) + 1; vencidosTodos++; } }
  const responsables = Array.from(new Map(indicadores.filter((i) => i.responsable).map((i) => [i.responsable!.id, i.responsable!])).values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  let filtered = indicadores.filter((i) => { const respOk = !activeResp || i.responsable_id === activeResp; const searchOk = !search || i.nombre.toLowerCase().includes(search.toLowerCase()); return respOk && searchOk; });
  if (sortDir) filtered = [...filtered].sort((a, b) => sortDir === "asc" ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre));

  // Inline name editing
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null);
  async function handleSaveName() {
    if (!editingName) return;
    const { id, value } = editingName;
    const trimmed = value.trim();
    if (!trimmed) { setEditingName(null); return; }
    setEditingName(null);
    await fetch("/api/indicadores/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: trimmed }) });
    router.refresh();
  }

  // Data entry modal
  const [modal, setModal] = useState<ModalState>({ open: false, indicadorId: "", indicadorNombre: "", metaCondicion: null, metaValor: null, frecuencia: "mensual" });
  const [modalAnio, setModalAnio] = useState(currentYear);
  const [modalMes, setModalMes] = useState<number | null>(currentMonth);
  const [valorInput, setValorInput] = useState("");
  const [comentarioInput, setComentarioInput] = useState("");
  const [cumpleManual, setCumpleManual] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const openModal = useCallback((ind: Indicador, anio: number, mes: number | null, existingRegistro?: Registro) => {
    setModal({ open: true, indicadorId: ind.id, indicadorNombre: ind.nombre, metaCondicion: ind.meta_condicion, metaValor: ind.meta_valor, frecuencia: ind.frecuencia });
    setModalAnio(anio);
    setModalMes(mes);
    setValorInput(existingRegistro?.valor ?? "");
    setComentarioInput(existingRegistro?.comentario ?? "");
    setCumpleManual(null);
    setSaveError(null);
  }, []);

  async function handleSave() {
    if (!valorInput.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch("/api/indicadores/" + modal.indicadorId + "/registros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anio: modalAnio, mes: modalMes, valor: valorInput.trim(), comentario: comentarioInput.trim() || null }) });
      if (!res.ok) { const err = await res.json(); setSaveError(err.error ?? "Error al guardar"); setSaving(false); return; }
      setModal((m) => ({ ...m, open: false })); router.refresh();
    } catch { setSaveError("Error de red"); } finally { setSaving(false); }
  }

  // Edit meta modal
  const [editMeta, setEditMeta] = useState({ open: false, indicadorId: "", indicadorNombre: "", meta_condicion: "", meta_valor: "", meta_unidad: "" });
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  function openEditMeta(ind: Indicador, e: React.MouseEvent) {
    e.stopPropagation();
    setEditMeta({ open: true, indicadorId: ind.id, indicadorNombre: ind.nombre, meta_condicion: ind.meta_condicion ?? "", meta_valor: ind.meta_valor ?? "", meta_unidad: ind.meta_unidad ?? "" });
    setMetaError(null);
  }

  async function handleSaveMeta() {
    setSavingMeta(true); setMetaError(null);
    try {
      const res = await fetch("/api/indicadores/" + editMeta.indicadorId, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meta_condicion: editMeta.meta_condicion || null, meta_valor: editMeta.meta_valor || null, meta_unidad: editMeta.meta_unidad || null }) });
      if (!res.ok) { const err = await res.json(); setMetaError(err.error ?? "Error al guardar"); setSavingMeta(false); return; }
      setEditMeta((m) => ({ ...m, open: false })); router.refresh();
    } catch { setMetaError("Error de red"); } finally { setSavingMeta(false); }
  }

  // New indicator modal
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoForm, setNuevoForm] = useState(EMPTY_NUEVO);
  const [savingNuevo, setSavingNuevo] = useState(false);
  const [nuevoError, setNuevoError] = useState<string | null>(null);
  const sectores = Array.from(new Set(indicadores.map((i) => i.sector))).sort();

  async function handleSaveNuevo() {
    if (!nuevoForm.nombre.trim() || !nuevoForm.sector.trim()) { setNuevoError("Nombre y sector son requeridos"); return; }
    setSavingNuevo(true); setNuevoError(null);
    try {
      const res = await fetch("/api/indicadores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuevoForm) });
      if (!res.ok) { const err = await res.json(); setNuevoError(err.error ?? "Error al crear"); setSavingNuevo(false); return; }
      setNuevoOpen(false); setNuevoForm(EMPTY_NUEVO); router.refresh();
    } catch { setNuevoError("Error de red"); } finally { setSavingNuevo(false); }
  }

  const needsManualCumple = modal.metaCondicion === "igual" || (!!valorInput && isNaN(parseFloat(valorInput.replace(",", "."))));
  const visibleMonths = Array.from({ length: currentMonth }, (_, i) => i + 1);
  const yearOptions = [currentYear - 1, currentYear];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 px-6 pt-4 pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input placeholder="Filtrar por título..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" /></div>
          {isAdmin && (
            <Button size="sm" onClick={() => { setNuevoForm(EMPTY_NUEVO); setNuevoError(null); setNuevoOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo indicador
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Responsable</span>
          <button onClick={() => setActiveResp(null)} className={cn("relative px-3 py-1 rounded-full text-xs font-medium transition-colors border", !activeResp ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>
            Todos{vencidosTodos > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">{vencidosTodos}</span>}
          </button>
          {responsables.map((r) => { const count = vencidosPorResp[r.id] ?? 0; return (<button key={r.id} onClick={() => setActiveResp(activeResp === r.id ? null : r.id)} className={cn("relative px-3 py-1 rounded-full text-xs font-medium transition-colors border", activeResp === r.id ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>{r.nombre.split(" ").slice(0, 2).join(" ")}{count > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">{count}</span>}</button>); })}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-slate-50 text-slate-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold min-w-[220px]"><button onClick={() => setSortDir((d) => d === null ? "asc" : d === "asc" ? "desc" : null)} className="flex items-center gap-1 hover:text-slate-700 transition-colors">Indicador{sortDir === null && <ArrowUpDown className="h-3 w-3 opacity-40" />}{sortDir === "asc" && <ArrowUp className="h-3 w-3" />}{sortDir === "desc" && <ArrowDown className="h-3 w-3" />}</button></th>
              <th className="text-left px-4 py-3 font-semibold w-[80px]">Periodo</th>
              <th className="text-left px-4 py-3 font-semibold w-[115px]">Responsable</th>
              <th className="text-left px-4 py-3 font-semibold w-[110px]">Meta</th>
              <th className="text-left px-4 py-3 font-semibold w-[90px]">Estado</th>
              {visibleMonths.map((m) => (<th key={m} className="text-center px-2 py-3 font-semibold w-[52px]">{MESES_CORTOS[m - 1]}</th>))}
            </tr></thead>
            <tbody>
              {(() => {
                const sectors = [...new Set(filtered.map(i => i.sector))].sort((a, b) => a.localeCompare(b, "es"));
                return sectors.flatMap(sector => {
                  const sectorInds = filtered.filter(i => i.sector === sector);
                  const colCount = 5 + visibleMonths.length;
                  return [
                    <tr key={`sector-${sector}`}>
                      <td colSpan={colCount} className="px-4 pt-4 pb-1.5 bg-slate-50 border-b border-t">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{sector}</span>
                      </td>
                    </tr>,
                    ...sectorInds.map((ind, idx) => {
                      const estado = calcularEstado(ind, hoy);
                      const metaCond = ind.meta_condicion; const metaSym = metaCond === "mayor" ? ">" : metaCond === "menor" ? "<" : metaCond === "mayor_igual" ? "≥" : metaCond === "menor_igual" ? "≤" : "=";
                      const metaDisplay = ind.meta_valor ? metaSym + " " + ind.meta_valor + " " + (ind.meta_unidad ?? "") : "— " + (ind.meta_unidad ?? "");
                      return (
                        <tr key={ind.id} onClick={() => editingName?.id !== ind.id && router.push("/indicadores/" + ind.id)} className={cn("border-b last:border-0 cursor-pointer hover:bg-slate-50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-slate-50/30")}>
                          <td className="px-4 py-2.5 align-middle">
                            {editingName?.id === ind.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  className="border rounded px-2 py-0.5 text-xs flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={editingName.value}
                                  onChange={(e) => setEditingName(n => n ? { ...n, value: e.target.value } : null)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(null); }}
                                  autoFocus
                                />
                                <button onClick={handleSaveName} className="text-green-600 hover:text-green-700 p-0.5"><Check className="h-3.5 w-3.5" /></button>
                                <button onClick={() => setEditingName(null)} className="text-slate-400 hover:text-slate-600 p-0.5"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group">
                                <p className={cn("font-medium text-xs leading-snug", estado === "vencido" ? "text-red-600" : "text-slate-800")}>{ind.nombre}</p>
                                {isAdmin && (
                                  <button onClick={(e) => { e.stopPropagation(); setEditingName({ id: ind.id, value: ind.nombre }); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-600 transition-opacity flex-shrink-0" title="Editar nombre">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 align-middle"><span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", ind.frecuencia === "anual" ? "text-violet-600 bg-violet-50" : "text-blue-600 bg-blue-50")}>{ind.frecuencia === "anual" ? "Anual" : "Mensual"}</span></td>
                          <td className="px-4 py-2.5 align-middle"><span className="text-slate-600 truncate block max-w-[110px]" title={ind.responsable?.nombre ?? ""}>{ind.responsable?.nombre ?? "—"}</span></td>
                          <td className="px-4 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 text-[10px] leading-tight">{metaDisplay}</span>
                              {isAdmin && <button onClick={(e) => openEditMeta(ind, e)} className="text-slate-300 hover:text-slate-600 transition-colors flex-shrink-0" title="Editar meta"><Pencil className="h-3 w-3" /></button>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-middle"><EstadoBadge estado={estado} /></td>
                          {ind.frecuencia === "anual" ? (
                            <td colSpan={visibleMonths.length} className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>{(() => {
                              const reg = getRegistro(ind.registros, null, currentYear);
                              if (reg) {
                                const bgClass = reg.cumple === true ? "bg-green-50 text-green-700 border-green-200" : reg.cumple === false ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200";
                                if (canDataEntry) return <button onClick={(e) => { e.stopPropagation(); openModal(ind, currentYear, null, reg); }} className={cn("text-center text-xs font-medium px-2 py-1 rounded border w-full hover:opacity-80 transition-opacity", bgClass)}>{reg.valor}{reg.cumple === true && <Check className="inline ml-1 h-3 w-3" />}{reg.cumple === false && <X className="inline ml-1 h-3 w-3" />}</button>;
                                return <div className={cn("text-center text-xs font-medium px-2 py-1 rounded border", bgClass)}>{reg.valor}{reg.cumple === true && <Check className="inline ml-1 h-3 w-3" />}{reg.cumple === false && <X className="inline ml-1 h-3 w-3" />}</div>;
                              }
                              if (canDataEntry) return <button onClick={(e) => { e.stopPropagation(); openModal(ind, currentYear, null); }} className="w-full text-center text-xs text-primary hover:bg-primary/10 rounded py-1 flex items-center justify-center gap-1 transition-colors"><Plus className="h-3 w-3" /> Cargar dato anual</button>;
                              return <div className="text-center text-slate-300">—</div>;
                            })()}</td>
                          ) : visibleMonths.map((mes) => {
                            const reg = getRegistro(ind.registros, mes, currentYear);
                            return <td key={mes} className="px-1 py-2 align-middle" onClick={(e) => e.stopPropagation()}><DataCell registro={reg} canInput={canDataEntry} onAdd={() => openModal(ind, currentYear, mes, reg)} /></td>;
                          })}
                        </tr>
                      );
                    }),
                  ];
                });
              })()}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-16 text-center text-sm text-slate-400">No hay indicadores para este filtro</div>}
        </div>
      </div>

      {/* Data entry modal */}
      <Dialog open={modal.open} onOpenChange={(o) => setModal((m) => ({ ...m, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">
              Cargar dato
              <span className="block text-xs font-normal text-slate-500 mt-0.5">{modal.indicadorNombre}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Period selector */}
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Año</Label>
                <Select value={String(modalAnio)} onValueChange={(v) => setModalAnio(Number(v))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {modal.frecuencia === "mensual" && (
                <div className="flex-[2] space-y-1">
                  <Label className="text-xs">Mes</Label>
                  <Select value={String(modalMes ?? currentMonth)} onValueChange={(v) => setModalMes(Number(v))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES_NOMBRES.map((nombre, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor-input">Valor</Label>
              <Input id="valor-input" placeholder={"Ej: " + (modal.metaValor ?? "0")} value={valorInput} onChange={(e) => { setValorInput(e.target.value); setCumpleManual(null); }} autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} />
              {modal.metaValor && <p className="text-xs text-slate-500">Meta: {modal.metaCondicion === "mayor" ? ">" : modal.metaCondicion === "menor" ? "<" : "="} {modal.metaValor}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comentario-input">Comentario <span className="text-slate-400">(opcional)</span></Label>
              <Textarea id="comentario-input" placeholder="Observaciones sobre este dato..." value={comentarioInput} onChange={(e) => setComentarioInput(e.target.value)} rows={2} />
            </div>
            {needsManualCumple && valorInput && (
              <div className="space-y-1.5">
                <Label>¿Cumple la meta?</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={cumpleManual === true ? "default" : "outline"} onClick={() => setCumpleManual(true)} className="gap-1.5"><Check className="h-3 w-3" /> Sí</Button>
                  <Button type="button" size="sm" variant={cumpleManual === false ? "destructive" : "outline"} onClick={() => setCumpleManual(false)} className="gap-1.5"><X className="h-3 w-3" /> No</Button>
                  <Button type="button" size="sm" variant={cumpleManual === null ? "secondary" : "outline"} onClick={() => setCumpleManual(null)} className="gap-1.5"><Minus className="h-3 w-3" /> N/A</Button>
                </div>
              </div>
            )}
            {saveError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModal((m) => ({ ...m, open: false }))}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !valorInput.trim()}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit meta modal */}
      <Dialog open={editMeta.open} onOpenChange={(o) => setEditMeta((m) => ({ ...m, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Editar meta
              <span className="block text-xs font-normal text-slate-500 mt-0.5">{editMeta.indicadorNombre}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Condición</Label>
              <Select value={editMeta.meta_condicion || "__none__"} onValueChange={(v) => setEditMeta((m) => ({ ...m, meta_condicion: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sin condición" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin condición</SelectItem>
                  <SelectItem value="mayor">&gt; Mayor que</SelectItem>
                  <SelectItem value="mayor_igual">≥ Mayor o igual</SelectItem>
                  <SelectItem value="menor">&lt; Menor que</SelectItem>
                  <SelectItem value="menor_igual">≤ Menor o igual</SelectItem>
                  <SelectItem value="igual">= Igual a</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor meta</Label>
              <Input placeholder="Ej: 95, verde, ok" value={editMeta.meta_valor} onChange={(e) => setEditMeta((m) => ({ ...m, meta_valor: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Unidad</Label>
              <Input placeholder="Ej: %, dias, unidades" value={editMeta.meta_unidad} onChange={(e) => setEditMeta((m) => ({ ...m, meta_unidad: e.target.value }))} />
            </div>
            {metaError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{metaError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditMeta((m) => ({ ...m, open: false }))}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveMeta} disabled={savingMeta}>{savingMeta ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New indicator modal */}
      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo indicador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input placeholder="Ej: Cumplimiento de auditorías internas" value={nuevoForm.nombre} onChange={(e) => setNuevoForm((f) => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Sector <span className="text-destructive">*</span></Label>
                <Input placeholder="Ej: Calidad, Producción" list="sectores-list" value={nuevoForm.sector} onChange={(e) => setNuevoForm((f) => ({ ...f, sector: e.target.value }))} />
                <datalist id="sectores-list">{sectores.map((s) => <option key={s} value={s} />)}</datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Frecuencia</Label>
                <Select value={nuevoForm.frecuencia} onValueChange={(v) => setNuevoForm((f) => ({ ...f, frecuencia: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Objetivo estratégico</Label>
                <Input placeholder="Ej: Mejorar la satisfacción del cliente" value={nuevoForm.objetivo_estrategico} onChange={(e) => setNuevoForm((f) => ({ ...f, objetivo_estrategico: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Fórmula <span className="text-slate-400 text-xs">(opcional)</span></Label>
                <Input placeholder="Ej: (Auditorías realizadas / Planificadas) × 100" value={nuevoForm.formula} onChange={(e) => setNuevoForm((f) => ({ ...f, formula: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Condición meta</Label>
                <Select value={nuevoForm.meta_condicion || "__none__"} onValueChange={(v) => setNuevoForm((f) => ({ ...f, meta_condicion: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin condición" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin condición</SelectItem>
                    <SelectItem value="mayor">&gt; Mayor que</SelectItem>
                    <SelectItem value="mayor_igual">≥ Mayor o igual</SelectItem>
                    <SelectItem value="menor">&lt; Menor que</SelectItem>
                    <SelectItem value="menor_igual">≤ Menor o igual</SelectItem>
                    <SelectItem value="igual">= Igual a</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor meta</Label>
                <Input placeholder="Ej: 95" value={nuevoForm.meta_valor} onChange={(e) => setNuevoForm((f) => ({ ...f, meta_valor: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidad</Label>
                <Input placeholder="Ej: %" value={nuevoForm.meta_unidad} onChange={(e) => setNuevoForm((f) => ({ ...f, meta_unidad: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Responsable</Label>
                <Select value={nuevoForm.responsable_id || "__none__"} onValueChange={(v) => setNuevoForm((f) => ({ ...f, responsable_id: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin responsable" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin responsable</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {nuevoError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{nuevoError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNuevoOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveNuevo} disabled={savingNuevo || !nuevoForm.nombre.trim() || !nuevoForm.sector.trim()}>{savingNuevo ? "Creando..." : "Crear indicador"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
