"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Plus, Check, X, Minus } from "lucide-react";
import { Usuario } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Registro {
  id: string;
  indicador_id: string;
  anio: number;
  mes: number | null;
  valor: string;
  cumple: boolean | null;
  comentario: string | null;
  cargado_por: string | null;
}

interface Indicador {
  id: string;
  sector: string;
  nombre: string;
  objetivo_estrategico: string;
  formula: string | null;
  responsable_id: string | null;
  frecuencia: string;
  meta_valor: string | null;
  meta_condicion: string | null;
  meta_unidad: string | null;
  orden: number;
  activo: boolean;
  responsable?: { id: string; nombre: string; email: string } | null;
  registros: Registro[];
}

interface Props {
  indicadores: Indicador[];
  usuario: Usuario;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

interface ModalState {
  open: boolean;
  indicadorId: string;
  indicadorNombre: string;
  metaCondicion: string | null;
  metaValor: string | null;
  anio: number;
  mes: number | null;
  frecuencia: string;
}

function getRegistro(registros: Registro[], mes: number | null, anio: number): Registro | undefined {
  if (mes === null) return registros.find((r) => r.anio === anio && r.mes === null);
  return registros.find((r) => r.anio === anio && r.mes === mes);
}

// ── Vencimiento logic ─────────────────────────────────────────────────────────

type EstadoVenc = "ok" | "pendiente" | "vencido" | "na";

function calcularEstado(ind: Indicador, hoy: Date): EstadoVenc {
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  const dia = hoy.getDate();

  if (ind.frecuencia === "anual") {
    const tiene = ind.registros.some((r) => r.anio === anio && r.mes === null);
    if (tiene) return "ok";
    if (mes === 1) return "pendiente";
    return "vencido";
  }

  // Mensual: el dato requerido es el mes anterior
  const mesPrevio = mes === 1 ? 12 : mes - 1;
  const anioPrevio = mes === 1 ? anio - 1 : anio;
  const tienePrevio = ind.registros.some((r) => r.anio === anioPrevio && r.mes === mesPrevio);
  if (tienePrevio) return "ok";
  if (dia <= 10) return "pendiente"; // Dentro del período de gracia (hasta el 10)
  return "vencido";
}

function EstadoBadge({ estado, frecuencia }: { estado: EstadoVenc; frecuencia: string }) {
  if (estado === "na") return null;

  const label =
    estado === "ok"       ? "Al día"    :
    estado === "pendiente"? "Pendiente" :
    "Vencido";

  const cls =
    estado === "ok"        ? "bg-green-50 text-green-700 border-green-200"  :
    estado === "pendiente" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
    "bg-red-50 text-red-700 border-red-200";

  const dot =
    estado === "ok"        ? "bg-green-400"  :
    estado === "pendiente" ? "bg-yellow-400" :
    "bg-red-400";

  const venc =
    frecuencia === "anual"
      ? "vence enero"
      : estado === "vencido" ? "día 10" : "hasta día 10";

  return (
    <div className={cn("inline-flex items-center gap-1 border rounded px-1.5 py-0.5 text-[10px] font-medium", cls)}
      title={`${label} · ${venc}`}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
      {label}
    </div>
  );
}

// ── DataCell ──────────────────────────────────────────────────────────────────

function DataCell({
  registro, isCurrentPeriod, canInput, onAdd, metaUnidad,
}: {
  registro: Registro | undefined;
  isCurrentPeriod: boolean;
  canInput: boolean;
  onAdd: () => void;
  metaUnidad: string | null;
}) {
  if (registro) {
    const bgClass =
      registro.cumple === true  ? "bg-green-50 text-green-800" :
      registro.cumple === false ? "bg-red-50 text-red-800"     :
      "bg-slate-50 text-slate-600";

    const displayVal = registro.valor.length > 8 ? registro.valor.slice(0, 8) + "…" : registro.valor;
    const suffix = metaUnidad && !["texto", "color", "puntaje"].includes(metaUnidad) ? "" : "";

    return (
      <div
        className={cn("text-center text-xs font-medium px-1 py-1 rounded min-h-[28px] flex items-center justify-center", bgClass)}
        title={`${registro.valor}${suffix}${registro.comentario ? ` · ${registro.comentario}` : ""}`}
      >
        {displayVal}
      </div>
    );
  }

  if (isCurrentPeriod && canInput) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        className="w-full text-center text-xs text-primary hover:bg-primary/10 rounded py-1 min-h-[28px] flex items-center justify-center transition-colors"
        title="Cargar dato"
      >
        <Plus className="h-3 w-3" />
      </button>
    );
  }

  return <div className="text-center text-xs text-slate-300 min-h-[28px] flex items-center justify-center">—</div>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function IndicadoresDashboard({ indicadores, usuario }: Props) {
  const router = useRouter();
  const hoy = new Date();
  const currentYear = hoy.getFullYear();
  const currentMonth = hoy.getMonth() + 1;

  // ── Filters ──────────────────────────────────────────────────────────────────
  const sectors = ["Todos", ...Array.from(new Set(indicadores.map((i) => i.sector))).sort()];
  const [activeSector, setActiveSector] = useState("Todos");

  // Count vencidos per sector
  const vencidosPorSector: Record<string, number> = {};
  let vencidosTodos = 0;
  for (const ind of indicadores) {
    if (calcularEstado(ind, hoy) === "vencido") {
      vencidosPorSector[ind.sector] = (vencidosPorSector[ind.sector] ?? 0) + 1;
      vencidosTodos++;
    }
  }

  const responsables = Array.from(
    new Map(
      indicadores
        .filter((i) => i.responsable)
        .map((i) => [i.responsable!.id, i.responsable!])
    ).values()
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const [activeResp, setActiveResp] = useState<string | null>(null);

  const filtered = indicadores.filter((i) => {
    const sectorOk = activeSector === "Todos" || i.sector === activeSector;
    const respOk = !activeResp || i.responsable_id === activeResp;
    return sectorOk && respOk;
  });

  // ── Modal ─────────────────────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalState>({
    open: false, indicadorId: "", indicadorNombre: "", metaCondicion: null,
    metaValor: null, anio: currentYear, mes: null, frecuencia: "mensual",
  });
  const [valorInput, setValorInput] = useState("");
  const [comentarioInput, setComentarioInput] = useState("");
  const [cumpleManual, setCumpleManual] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isAdmin = usuario.rol === "admin";

  const openModal = useCallback((ind: Indicador, anio: number, mes: number | null) => {
    setModal({ open: true, indicadorId: ind.id, indicadorNombre: ind.nombre,
      metaCondicion: ind.meta_condicion, metaValor: ind.meta_valor, anio, mes, frecuencia: ind.frecuencia });
    setValorInput(""); setComentarioInput(""); setCumpleManual(null); setSaveError(null);
  }, []);

  async function handleSave() {
    if (!valorInput.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch(`/api/indicadores/${modal.indicadorId}/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anio: modal.anio, mes: modal.mes, valor: valorInput.trim(), comentario: comentarioInput.trim() || null }),
      });
      if (!res.ok) { const err = await res.json(); setSaveError(err.error ?? "Error al guardar"); setSaving(false); return; }
      setModal((m) => ({ ...m, open: false }));
      router.refresh();
    } catch { setSaveError("Error de red"); }
    finally { setSaving(false); }
  }

  const needsManualCumple = modal.metaCondicion === "igual" || (!!valorInput && isNaN(parseFloat(valorInput.replace(",", "."))));
  const visibleMonths = Array.from({ length: currentMonth }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full">

      {/* ── Sector filter ── */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-1 flex-wrap border-b">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Sector</span>
        {sectors.map((s) => {
          const count = s === "Todos" ? vencidosTodos : (vencidosPorSector[s] ?? 0);
          return (
            <button key={s} onClick={() => setActiveSector(s)}
              className={cn("relative px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                activeSector === s ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}>
              {s}
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Responsable filter ── */}
      <div className="flex items-center gap-2 px-6 py-2 flex-wrap border-b bg-slate-50/50">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Responsable</span>
        <button onClick={() => setActiveResp(null)}
          className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors border",
            !activeResp ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}>
          Todos
        </button>
        {responsables.map((r) => (
          <button key={r.id} onClick={() => setActiveResp(activeResp === r.id ? null : r.id)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              activeResp === r.id ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}>
            {r.nombre.split(" ")[0]} {r.nombre.split(" ")[1] ?? ""}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold w-[130px]">Sector</th>
                <th className="text-left px-4 py-3 font-semibold min-w-[200px]">Indicador</th>
                <th className="text-left px-4 py-3 font-semibold w-[115px]">Responsable</th>
                <th className="text-left px-4 py-3 font-semibold w-[90px]">Meta</th>
                <th className="text-left px-4 py-3 font-semibold w-[90px]">Estado</th>
                {visibleMonths.map((m) => (
                  <th key={m} className="text-center px-2 py-3 font-semibold w-[52px]">
                    {MESES_CORTOS[m - 1]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ind, idx) => {
                const isResponsable = ind.responsable_id === usuario.id;
                const canInput = isAdmin || isResponsable;
                const estado = calcularEstado(ind, hoy);

                const metaDisplay = ind.meta_valor
                  ? `${ind.meta_condicion === "mayor" ? ">" : ind.meta_condicion === "menor" ? "<" : ind.meta_condicion === "mayor_igual" ? "≥" : ind.meta_condicion === "menor_igual" ? "≤" : "="} ${ind.meta_valor} ${ind.meta_unidad ?? ""}`
                  : `— ${ind.meta_unidad ?? ""}`;

                return (
                  <tr key={ind.id} onClick={() => router.push(`/indicadores/${ind.id}`)}
                    className={cn("border-b last:border-0 cursor-pointer hover:bg-slate-50 transition-colors",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                    )}>

                    <td className="px-4 py-2.5 align-middle">
                      <span className="inline-block text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full truncate max-w-[120px]" title={ind.sector}>
                        {ind.sector}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 align-middle">
                      <p className="font-medium text-slate-800 text-xs leading-snug">{ind.nombre}</p>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0 rounded font-medium",
                        ind.frecuencia === "anual"
                          ? "text-violet-600 bg-violet-50"
                          : "text-blue-600 bg-blue-50"
                      )}>
                        {ind.frecuencia === "anual" ? "Anual · vence enero" : "Mensual · vence día 10"}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 align-middle">
                      <span className="text-slate-600 truncate block max-w-[110px]" title={ind.responsable?.nombre ?? ""}>
                        {ind.responsable?.nombre ?? "—"}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 align-middle text-slate-500 text-[10px] leading-tight">
                      {metaDisplay}
                    </td>

                    <td className="px-4 py-2.5 align-middle">
                      <EstadoBadge estado={estado} frecuencia={ind.frecuencia} />
                    </td>

                    {/* Annual */}
                    {ind.frecuencia === "anual" ? (
                      <td colSpan={visibleMonths.length} className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const reg = getRegistro(ind.registros, null, currentYear);
                          if (reg) {
                            const bgClass = reg.cumple === true ? "bg-green-50 text-green-700 border-green-200"
                              : reg.cumple === false ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-slate-50 text-slate-600 border-slate-200";
                            return (
                              <div className={cn("text-center text-xs font-medium px-2 py-1 rounded border", bgClass)}>
                                {reg.valor}
                                {reg.cumple === true && <Check className="inline ml-1 h-3 w-3" />}
                                {reg.cumple === false && <X className="inline ml-1 h-3 w-3" />}
                              </div>
                            );
                          }
                          if (canInput) {
                            return (
                              <button onClick={(e) => { e.stopPropagation(); openModal(ind, currentYear, null); }}
                                className="w-full text-center text-xs text-primary hover:bg-primary/10 rounded py-1 flex items-center justify-center gap-1 transition-colors">
                                <Plus className="h-3 w-3" /> Cargar dato anual
                              </button>
                            );
                          }
                          return <div className="text-center text-slate-300">—</div>;
                        })()}
                      </td>
                    ) : (
                      visibleMonths.map((mes) => {
                        const reg = getRegistro(ind.registros, mes, currentYear);
                        const isCurrentPeriod = mes === currentMonth;
                        return (
                          <td key={mes} className="px-1 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                            <DataCell
                              registro={reg}
                              isCurrentPeriod={isCurrentPeriod}
                              canInput={canInput}
                              onAdd={() => openModal(ind, currentYear, mes)}
                              metaUnidad={ind.meta_unidad}
                            />
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-400">
              No hay indicadores para este filtro
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      <Dialog open={modal.open} onOpenChange={(o) => setModal((m) => ({ ...m, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">
              Cargar dato
              <span className="block text-xs font-normal text-slate-500 mt-0.5">{modal.indicadorNombre}</span>
              {modal.frecuencia === "mensual" && modal.mes && (
                <span className="block text-xs font-normal text-slate-500">{MESES_CORTOS[modal.mes - 1]} {modal.anio}</span>
              )}
              {modal.frecuencia === "anual" && (
                <span className="block text-xs font-normal text-slate-500">Año {modal.anio}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="valor-input">Valor</Label>
              <Input id="valor-input" placeholder={`Ej: ${modal.metaValor ?? "0"}`} value={valorInput}
                onChange={(e) => { setValorInput(e.target.value); setCumpleManual(null); }}
                autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} />
              {modal.metaValor && (
                <p className="text-xs text-slate-500">
                  Meta: {modal.metaCondicion === "mayor" ? ">" : modal.metaCondicion === "menor" ? "<" : "="} {modal.metaValor}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comentario-input">Comentario <span className="text-slate-400">(opcional)</span></Label>
              <Textarea id="comentario-input" placeholder="Observaciones sobre este dato..." value={comentarioInput}
                onChange={(e) => setComentarioInput(e.target.value)} rows={2} />
            </div>

            {needsManualCumple && valorInput && (
              <div className="space-y-1.5">
                <Label>¿Cumple la meta?</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={cumpleManual === true ? "default" : "outline"} onClick={() => setCumpleManual(true)} className="gap-1.5">
                    <Check className="h-3 w-3" /> Sí
                  </Button>
                  <Button type="button" size="sm" variant={cumpleManual === false ? "destructive" : "outline"} onClick={() => setCumpleManual(false)} className="gap-1.5">
                    <X className="h-3 w-3" /> No
                  </Button>
                  <Button type="button" size="sm" variant={cumpleManual === null ? "secondary" : "outline"} onClick={() => setCumpleManual(null)} className="gap-1.5">
                    <Minus className="h-3 w-3" /> N/A
                  </Button>
                </div>
              </div>
            )}

            {saveError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{saveError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModal((m) => ({ ...m, open: false }))}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !valorInput.trim()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
