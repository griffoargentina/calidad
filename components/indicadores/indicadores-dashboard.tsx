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

// ── Modal state ───────────────────────────────────────────────────────────────

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

// ── Helper: get registro for month ───────────────────────────────────────────

function getRegistro(registros: Registro[], mes: number | null, anio: number): Registro | undefined {
  if (mes === null) {
    return registros.find((r) => r.anio === anio && r.mes === null);
  }
  return registros.find((r) => r.anio === anio && r.mes === mes);
}

// ── Cell component ────────────────────────────────────────────────────────────

function DataCell({
  registro,
  isCurrentPeriod,
  canInput,
  onAdd,
  metaUnidad,
}: {
  registro: Registro | undefined;
  isCurrentPeriod: boolean;
  canInput: boolean;
  onAdd: () => void;
  metaUnidad: string | null;
}) {
  if (registro) {
    const bgClass =
      registro.cumple === true
        ? "bg-green-50 text-green-800"
        : registro.cumple === false
        ? "bg-red-50 text-red-800"
        : "bg-slate-50 text-slate-600";

    const displayVal = registro.valor.length > 8
      ? registro.valor.slice(0, 8) + "…"
      : registro.valor;

    const unitSuffix = metaUnidad && !["texto", "color", "puntaje"].includes(metaUnidad ?? "")
      ? ""
      : "";

    return (
      <div
        className={cn(
          "text-center text-xs font-medium px-1 py-1 rounded min-h-[28px] flex items-center justify-center",
          bgClass
        )}
        title={`${registro.valor}${unitSuffix}${registro.comentario ? ` · ${registro.comentario}` : ""}`}
      >
        {displayVal}
      </div>
    );
  }

  if (isCurrentPeriod && canInput) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="w-full text-center text-xs text-primary hover:bg-primary/10 rounded py-1 min-h-[28px] flex items-center justify-center transition-colors"
        title="Cargar dato"
      >
        <Plus className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="text-center text-xs text-slate-300 min-h-[28px] flex items-center justify-center">
      —
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function IndicadoresDashboard({ indicadores, usuario }: Props) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Sector filter
  const sectors = ["Todos", ...Array.from(new Set(indicadores.map((i) => i.sector))).sort()];
  const [activeSector, setActiveSector] = useState("Todos");

  // Modal state
  const [modal, setModal] = useState<ModalState>({
    open: false,
    indicadorId: "",
    indicadorNombre: "",
    metaCondicion: null,
    metaValor: null,
    anio: currentYear,
    mes: null,
    frecuencia: "mensual",
  });
  const [valorInput, setValorInput] = useState("");
  const [comentarioInput, setComentarioInput] = useState("");
  const [cumpleManual, setCumpleManual] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isAdmin = usuario.rol === "admin";

  // Filtered indicadores
  const filtered = activeSector === "Todos"
    ? indicadores
    : indicadores.filter((i) => i.sector === activeSector);

  // Open modal
  const openModal = useCallback((
    ind: Indicador,
    anio: number,
    mes: number | null
  ) => {
    setModal({
      open: true,
      indicadorId: ind.id,
      indicadorNombre: ind.nombre,
      metaCondicion: ind.meta_condicion,
      metaValor: ind.meta_valor,
      anio,
      mes,
      frecuencia: ind.frecuencia,
    });
    setValorInput("");
    setComentarioInput("");
    setCumpleManual(null);
    setSaveError(null);
  }, []);

  // Save
  async function handleSave() {
    if (!valorInput.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/indicadores/${modal.indicadorId}/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anio: modal.anio,
          mes: modal.mes,
          valor: valorInput.trim(),
          comentario: comentarioInput.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "Error al guardar");
        setSaving(false);
        return;
      }
      setModal((m) => ({ ...m, open: false }));
      router.refresh();
    } catch {
      setSaveError("Error de red");
    } finally {
      setSaving(false);
    }
  }

  // Determine if value needs manual cumple toggle
  const needsManualCumple =
    modal.metaCondicion === "igual" ||
    (valorInput && isNaN(parseFloat(valorInput.replace(",", "."))));

  // Visible months: up to current month (for table header)
  const visibleMonths = Array.from({ length: currentMonth }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full">
      {/* Sector tabs */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-2 flex-wrap">
        {sectors.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSector(s)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              activeSector === s
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold w-[140px]">Sector</th>
                <th className="text-left px-4 py-3 font-semibold min-w-[220px]">Indicador</th>
                <th className="text-left px-4 py-3 font-semibold w-[120px]">Responsable</th>
                <th className="text-left px-4 py-3 font-semibold w-[100px]">Meta</th>
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

                const metaDisplay = ind.meta_valor
                  ? `${ind.meta_condicion === "mayor" ? ">" : ind.meta_condicion === "menor" ? "<" : "="} ${ind.meta_valor} ${ind.meta_unidad ?? ""}`
                  : `${ind.meta_condicion === "mayor" ? ">" : ind.meta_condicion === "menor" ? "<" : "="} — ${ind.meta_unidad ?? ""}`;

                return (
                  <tr
                    key={ind.id}
                    onClick={() => router.push(`/indicadores/${ind.id}`)}
                    className={cn(
                      "border-b last:border-0 cursor-pointer hover:bg-slate-50 transition-colors",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                    )}
                  >
                    <td className="px-4 py-2.5 align-middle">
                      <span className="inline-block text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full truncate max-w-[130px]" title={ind.sector}>
                        {ind.sector}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <p className="font-medium text-slate-800 text-xs leading-snug">{ind.nombre}</p>
                      {ind.frecuencia === "anual" && (
                        <span className="text-[10px] text-slate-400">Anual</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <span className="text-slate-600 truncate block max-w-[115px]" title={ind.responsable?.nombre ?? ""}>
                        {ind.responsable?.nombre ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-middle text-slate-500 text-[10px] leading-tight">
                      {metaDisplay}
                    </td>

                    {/* Annual indicators: show merged cell across all months */}
                    {ind.frecuencia === "anual" ? (
                      <td
                        colSpan={visibleMonths.length}
                        className="px-2 py-2 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const reg = getRegistro(ind.registros, null, currentYear);
                          if (reg) {
                            const bgClass =
                              reg.cumple === true
                                ? "bg-green-50 text-green-700 border-green-200"
                                : reg.cumple === false
                                ? "bg-red-50 text-red-700 border-red-200"
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
                              <button
                                onClick={(e) => { e.stopPropagation(); openModal(ind, currentYear, null); }}
                                className="w-full text-center text-xs text-primary hover:bg-primary/10 rounded py-1 flex items-center justify-center gap-1 transition-colors"
                              >
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
                          <td
                            key={mes}
                            className="px-1 py-2 align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
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
              No hay indicadores en este sector
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={modal.open} onOpenChange={(o) => setModal((m) => ({ ...m, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">
              Cargar dato
              <span className="block text-xs font-normal text-slate-500 mt-0.5">
                {modal.indicadorNombre}
              </span>
              {modal.frecuencia === "mensual" && modal.mes && (
                <span className="block text-xs font-normal text-slate-500">
                  {MESES_CORTOS[modal.mes - 1]} {modal.anio}
                </span>
              )}
              {modal.frecuencia === "anual" && (
                <span className="block text-xs font-normal text-slate-500">
                  Año {modal.anio}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="valor-input">Valor</Label>
              <Input
                id="valor-input"
                placeholder={`Ej: ${modal.metaValor ?? "0"}`}
                value={valorInput}
                onChange={(e) => { setValorInput(e.target.value); setCumpleManual(null); }}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
              {modal.metaValor && (
                <p className="text-xs text-slate-500">
                  Meta: {modal.metaCondicion === "mayor" ? ">" : modal.metaCondicion === "menor" ? "<" : "="} {modal.metaValor}
                  {modal.metaCondicion && ` (${modal.metaCondicion})`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comentario-input">Comentario <span className="text-slate-400">(opcional)</span></Label>
              <Textarea
                id="comentario-input"
                placeholder="Observaciones sobre este dato..."
                value={comentarioInput}
                onChange={(e) => setComentarioInput(e.target.value)}
                rows={2}
              />
            </div>

            {/* Manual cumple toggle for text/equal types */}
            {needsManualCumple && valorInput && (
              <div className="space-y-1.5">
                <Label>¿Cumple la meta?</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={cumpleManual === true ? "default" : "outline"}
                    onClick={() => setCumpleManual(true)}
                    className="gap-1.5"
                  >
                    <Check className="h-3 w-3" /> Sí
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={cumpleManual === false ? "destructive" : "outline"}
                    onClick={() => setCumpleManual(false)}
                    className="gap-1.5"
                  >
                    <X className="h-3 w-3" /> No
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={cumpleManual === null ? "secondary" : "outline"}
                    onClick={() => setCumpleManual(null)}
                    className="gap-1.5"
                  >
                    <Minus className="h-3 w-3" /> N/A
                  </Button>
                </div>
              </div>
            )}

            {saveError && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{saveError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModal((m) => ({ ...m, open: false }))}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !valorInput.trim()}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
