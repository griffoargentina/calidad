"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Target, User, RefreshCw, BarChart2, Plus, Check, X, Minus,
  Calendar, MessageSquare, ArrowLeft, ClipboardList
} from "lucide-react";
import Link from "next/link";
import { Usuario } from "@/types/database";

interface Registro {
  id: string;
  indicador_id: string;
  anio: number;
  mes: number | null;
  valor: string;
  cumple: boolean | null;
  comentario: string | null;
  plan_accion: string | null;
  cargado_por: string | null;
  created_at: string;
  updated_at: string;
  cargado_por_usuario?: { id: string; nombre: string } | null;
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
  indicador: Indicador;
  usuario: Usuario;
}

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function formatPeriodo(anio: number, mes: number | null): string {
  if (mes === null) return `Anual ${anio}`;
  return `${MESES_NOMBRES[mes - 1]} ${anio}`;
}

function MiniBarChart({ registros, metaValor }: { registros: Registro[]; metaValor: string | null }) {
  const currentYear = new Date().getFullYear();
  const yearRegistros = registros.filter((r) => r.anio === currentYear && r.mes !== null);

  if (yearRegistros.length === 0) {
    return <div className="flex items-center justify-center h-24 text-sm text-slate-400">Sin datos para mostrar</div>;
  }

  const numericRegistros = yearRegistros
    .map((r) => ({ ...r, numVal: parseFloat(r.valor.replace(",", ".")) }))
    .filter((r) => !isNaN(r.numVal))
    .sort((a, b) => (a.mes ?? 0) - (b.mes ?? 0));

  if (numericRegistros.length === 0) {
    return (
      <div className="flex flex-wrap gap-2">
        {yearRegistros.sort((a, b) => (a.mes ?? 0) - (b.mes ?? 0)).map((r) => (
          <div key={r.id} className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs",
            r.cumple === true ? "bg-green-50 border-green-200 text-green-700"
              : r.cumple === false ? "bg-red-50 border-red-200 text-red-700"
              : "bg-slate-50 border-slate-200 text-slate-600")}>
            <span className="font-semibold">{MESES_CORTOS[(r.mes ?? 1) - 1]}</span>
            <span>{r.valor}</span>
          </div>
        ))}
      </div>
    );
  }

  const values = numericRegistros.map((r) => r.numVal);
  const meta = metaValor ? parseFloat(metaValor) : null;
  const allValues = meta !== null ? [...values, meta] : values;
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;
  const chartHeight = 80;
  const barWidth = Math.max(24, Math.min(40, 400 / numericRegistros.length));
  const gap = 4;
  const totalWidth = numericRegistros.length * (barWidth + gap);

  return (
    <div className="overflow-x-auto">
      <svg width={totalWidth + 40} height={chartHeight + 36} className="overflow-visible">
        {meta !== null && (
          <line x1={20} y1={chartHeight - ((meta - minVal) / range) * chartHeight}
            x2={totalWidth + 20} y2={chartHeight - ((meta - minVal) / range) * chartHeight}
            stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" />
        )}
        {numericRegistros.map((r, i) => {
          const x = 20 + i * (barWidth + gap);
          const barH = Math.max(2, ((r.numVal - minVal) / range) * chartHeight);
          const y = chartHeight - barH;
          const color = r.cumple === true ? "#22c55e" : r.cumple === false ? "#ef4444" : "#94a3b8";
          return (
            <g key={r.id}>
              <rect x={x} y={y} width={barWidth} height={barH} rx={3} fill={color} fillOpacity={0.8} />
              <text x={x + barWidth / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="#64748b">
                {r.numVal % 1 === 0 ? r.numVal : r.numVal.toFixed(2)}
              </text>
              <text x={x + barWidth / 2} y={chartHeight + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {MESES_CORTOS[(r.mes ?? 1) - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block" /> Cumple</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> No cumple</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300 inline-block" /> Sin clasificar</span>
        {meta !== null && (
          <span className="flex items-center gap-1.5">
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" /></svg>
            Meta: {meta}
          </span>
        )}
      </div>
    </div>
  );
}

export function IndicadorDetalle({ indicador, usuario }: Props) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const isAdmin = usuario.rol === "admin";
  const isResponsable = indicador.responsable_id === usuario.id;
  const isEditor = usuario.rol === "editor";
  const canInput = isAdmin || isResponsable || isEditor;

  const [modalOpen, setModalOpen] = useState(false);
  const [valorInput, setValorInput] = useState("");
  const [comentarioInput, setComentarioInput] = useState("");
  const [planAccionInput, setPlanAccionInput] = useState("");
  const [anioBuscar, setAnioBuscar] = useState(currentYear);
  const [mesBuscar, setMesBuscar] = useState<number | null>(indicador.frecuencia === "anual" ? null : currentMonth);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function openModal() {
    setValorInput(""); setComentarioInput(""); setPlanAccionInput(""); setSaveError(null); setModalOpen(true);
  }

  async function handleSave() {
    if (!valorInput.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch(`/api/indicadores/${indicador.id}/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anio: anioBuscar, mes: indicador.frecuencia === "anual" ? null : mesBuscar, valor: valorInput.trim(), comentario: comentarioInput.trim() || null, plan_accion: planAccionInput.trim() || null }),
      });
      if (!res.ok) { const err = await res.json(); setSaveError(err.error ?? "Error al guardar"); setSaving(false); return; }
      setModalOpen(false);
      router.refresh();
    } catch { setSaveError("Error de red"); }
    finally { setSaving(false); }
  }

  const condDisplay = indicador.meta_condicion === "mayor" ? ">" : indicador.meta_condicion === "menor" ? "<" : "=";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="sm" asChild className="-ml-2 mt-0.5">
              <Link href="/indicadores"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link>
            </Button>
          </div>
          {canInput && (
            <Button size="sm" onClick={openModal} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" />Cargar dato
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
                <BarChart2 className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="secondary" className="text-xs">{indicador.sector}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{indicador.frecuencia}</Badge>
                  {!indicador.activo && <Badge variant="destructive" className="text-xs">Inactivo</Badge>}
                </div>
                <h1 className="text-xl font-bold text-slate-900 leading-snug">{indicador.nombre}</h1>
                <p className="text-sm text-slate-500 mt-1">{indicador.objetivo_estrategico}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <InfoItem icon={<Target className="h-4 w-4 text-primary" />} label="Meta"
                value={indicador.meta_valor ? `${condDisplay} ${indicador.meta_valor} ${indicador.meta_unidad ?? ""}` : `${condDisplay} — ${indicador.meta_unidad ?? ""}`} />
              <InfoItem icon={<User className="h-4 w-4 text-slate-500" />} label="Responsable" value={indicador.responsable?.nombre ?? "—"} />
              <InfoItem icon={<RefreshCw className="h-4 w-4 text-slate-500" />} label="Frecuencia" value={indicador.frecuencia === "anual" ? "Anual" : "Mensual"} />
              {indicador.formula && <InfoItem icon={<BarChart2 className="h-4 w-4 text-slate-500" />} label="Fórmula" value={indicador.formula} />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />Evolución {currentYear}
            </CardTitle>
          </CardHeader>
          <CardContent><MiniBarChart registros={indicador.registros} metaValor={indicador.meta_valor} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />Historial completo
              <span className="text-xs font-normal text-slate-400 ml-1">({indicador.registros.length} registros)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {indicador.registros.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">Sin registros cargados</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-semibold">Período</th>
                    <th className="text-left px-4 py-3 font-semibold">Valor</th>
                    <th className="text-left px-4 py-3 font-semibold">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold">Comentario</th>
                    <th className="text-left px-4 py-3 font-semibold">
                      <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3 text-blue-400" />Plan de acción</span>
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">Cargado por</th>
                  </tr>
                </thead>
                <tbody>
                  {indicador.registros.map((reg) => (
                    <tr key={reg.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-700">{formatPeriodo(reg.anio, reg.mes)}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-slate-800">
                          {reg.valor}{indicador.meta_unidad && !["texto", "color", "puntaje"].includes(indicador.meta_unidad) ? ` ${indicador.meta_unidad}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {reg.cumple === true && <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-medium"><Check className="h-3 w-3" /> Cumple</span>}
                        {reg.cumple === false && <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-[10px] font-medium"><X className="h-3 w-3" /> No cumple</span>}
                        {reg.cumple === null && <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-medium"><Minus className="h-3 w-3" /> S/D</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {reg.comentario ? <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3 shrink-0 text-slate-400" />{reg.comentario}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px]">
                        {reg.plan_accion ? <span className="flex items-start gap-1"><ClipboardList className="h-3 w-3 shrink-0 text-blue-400 mt-0.5" /><span className="break-words">{reg.plan_accion}</span></span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{reg.cargado_por_usuario?.nombre ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">
              Cargar dato
              <span className="block text-xs font-normal text-slate-500 mt-0.5">{indicador.nombre}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {indicador.frecuencia === "mensual" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Año</Label><Input type="number" value={anioBuscar} onChange={(e) => setAnioBuscar(parseInt(e.target.value))} min={2020} max={2099} /></div>
                <div className="space-y-1.5"><Label>Mes</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={mesBuscar ?? ""} onChange={(e) => setMesBuscar(parseInt(e.target.value))}>
                    {MESES_NOMBRES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5"><Label>Año</Label><Input type="number" value={anioBuscar} onChange={(e) => setAnioBuscar(parseInt(e.target.value))} min={2020} max={2099} /></div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="valor-det-input">Valor</Label>
              <Input id="valor-det-input" placeholder={`Ej: ${indicador.meta_valor ?? "0"}`} value={valorInput}
                onChange={(e) => setValorInput(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} />
              {indicador.meta_valor && <p className="text-xs text-slate-500">Meta: {condDisplay} {indicador.meta_valor} {indicador.meta_unidad ?? ""}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comentario-det">Comentario <span className="text-slate-400">(opcional)</span></Label>
              <Textarea id="comentario-det" placeholder="Observaciones..." value={comentarioInput} onChange={(e) => setComentarioInput(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-accion-det" className="flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
                Plan de acción <span className="text-slate-400">(opcional)</span>
              </Label>
              <Textarea id="plan-accion-det" placeholder="Acciones a tomar..." value={planAccionInput} onChange={(e) => setPlanAccionInput(e.target.value)} rows={2} />
            </div>
            {saveError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !valorInput.trim()}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</div>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
