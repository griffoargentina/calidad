"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ChevronRight } from "lucide-react";
import { SehVEstado, SehUbicacion, SehEstado } from "@/types/seh";
import { SehFormDialog } from "./seh-form-dialog";

interface SehDashboardProps {
  requisitosIniciales: SehVEstado[];
  ubicaciones: SehUbicacion[];
  canEdit: boolean;
}

const ESTADO_CONFIG: Record<SehEstado, { label: string; className: string }> = {
  completado:       { label: "Completado",       className: "bg-green-100 text-green-800 border-green-200" },
  en_fecha:         { label: "En fecha",          className: "bg-blue-100 text-blue-800 border-blue-200" },
  proximo_a_vencer: { label: "Por vencer",        className: "bg-amber-100 text-amber-800 border-amber-200" },
  vencido:          { label: "Vencido",           className: "bg-red-100 text-red-800 border-red-200" },
  faltante:         { label: "Faltante",          className: "bg-slate-100 text-slate-600 border-slate-200" },
  no_corresponde:   { label: "No corresponde",    className: "bg-slate-50 text-slate-400 border-slate-100" },
};

const AMBITO_LABELS: Record<string, string> = {
  seguridad_higiene: "Seguridad e Higiene",
  medio_ambiente: "Medio Ambiente",
};

function EstadoBadge({ estado }: { estado: SehEstado }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, className: "" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function SehDashboard({ requisitosIniciales, ubicaciones, canEdit }: SehDashboardProps) {
  const router = useRouter();
  const [requisitos, setRequisitos] = useState<SehVEstado[]>(requisitosIniciales);
  const [filterUbicacion, setFilterUbicacion] = useState("todos");
  const [filterAmbito, setFilterAmbito] = useState("todos");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    return requisitos.filter((r) => {
      if (filterUbicacion !== "todos" && r.ubicacion_id !== filterUbicacion) return false;
      if (filterAmbito !== "todos" && r.ambito !== filterAmbito) return false;
      if (filterEstado !== "todos" && r.estado !== filterEstado) return false;
      return true;
    });
  }, [requisitos, filterUbicacion, filterAmbito, filterEstado]);

  // Group by ambito then ubicacion
  const groups = useMemo(() => {
    const map = new Map<string, Map<string, SehVEstado[]>>();
    for (const r of filtered) {
      if (!map.has(r.ambito)) map.set(r.ambito, new Map());
      const sub = map.get(r.ambito)!;
      if (!sub.has(r.ubicacion_nombre)) sub.set(r.ubicacion_nombre, []);
      sub.get(r.ubicacion_nombre)!.push(r);
    }
    return map;
  }, [filtered]);

  async function refreshData() {
    const res = await fetch("/api/seh/requisitos");
    if (res.ok) {
      const data = await res.json();
      setRequisitos(data);
    }
    router.refresh();
  }

  const stats = useMemo(() => {
    const counts: Partial<Record<SehEstado, number>> = {};
    for (const r of requisitos) {
      counts[r.estado] = (counts[r.estado] ?? 0) + 1;
    }
    return counts;
  }, [requisitos]);

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {(Object.entries(ESTADO_CONFIG) as [SehEstado, typeof ESTADO_CONFIG[SehEstado]][]).map(([estado, cfg]) => (
          <button
            key={estado}
            onClick={() => setFilterEstado(filterEstado === estado ? "todos" : estado)}
            className={`rounded-lg border p-3 text-center transition-all hover:shadow-sm ${cfg.className} ${filterEstado === estado ? "ring-2 ring-offset-1 ring-current" : ""}`}
          >
            <p className="text-2xl font-bold">{stats[estado] ?? 0}</p>
            <p className="text-xs mt-0.5">{cfg.label}</p>
          </button>
        ))}
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterUbicacion} onValueChange={setFilterUbicacion}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Ubicación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las ubicaciones</SelectItem>
            {ubicaciones.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterAmbito} onValueChange={setFilterAmbito}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ámbito" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los ámbitos</SelectItem>
            <SelectItem value="seguridad_higiene">Seguridad e Higiene</SelectItem>
            <SelectItem value="medio_ambiente">Medio Ambiente</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {canEdit && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo requisito
          </Button>
        )}
      </div>

      {/* Table grouped by ambito → ubicacion */}
      {Array.from(groups.entries()).map(([ambito, subMap]) => (
        <div key={ambito} className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            {AMBITO_LABELS[ambito] ?? ambito}
          </h2>

          {Array.from(subMap.entries()).map(([ubicNombre, items]) => (
            <div key={ubicNombre} className="rounded-lg border bg-white overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{ubicNombre}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="px-4 py-2 text-left font-medium">Requisito</th>
                    <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">Norma</th>
                    <th className="px-4 py-2 text-left font-medium">Vencimiento</th>
                    <th className="px-4 py-2 text-left font-medium">Estado</th>
                    <th className="px-4 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((r) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${r.estado === "no_corresponde" ? "opacity-50" : ""}`}
                      onClick={() => router.push(`/seh/${r.requisito_id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">{r.nombre}</td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell text-xs">{r.norma ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.fecha_vencimiento ? (
                          <span>
                            {formatDate(r.fecha_vencimiento)}
                            {r.dias_vencido != null && r.dias_vencido > 0 && (
                              <span className="ml-1 text-xs text-red-500">({r.dias_vencido}d)</span>
                            )}
                            {r.dias_hasta_vencimiento != null && r.dias_hasta_vencimiento <= 30 && r.dias_hasta_vencimiento >= 0 && (
                              <span className="ml-1 text-xs text-amber-500">({r.dias_hasta_vencimiento}d)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            {r.tipo_vencimiento === "sin_vencimiento" ? "Sin vencimiento" :
                             r.tipo_vencimiento === "segun_plan" ? "Según plan" :
                             r.fecha_realizada ? "Completado" : "Sin fecha"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={r.estado} />
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          No hay requisitos que coincidan con los filtros seleccionados.
        </div>
      )}

      <SehFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refreshData}
        ubicaciones={ubicaciones}
      />
    </div>
  );
}
