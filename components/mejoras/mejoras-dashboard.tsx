"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, TrendingUp, AlertTriangle, Camera,
  ChevronRight, CheckCircle2, Clock, Pencil, Trash2, X,
} from "lucide-react";
import { MejoraConFotos, SECTORES } from "@/types/mejora";
import { MejoraFormDialog } from "./mejora-form-dialog";

interface Props {
  mejorasIniciales: MejoraConFotos[];
  userId: string;
  canEditAll: boolean;
  userName: string;
  userSector: string | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function fdate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

type EstadoFilter = "all" | "en_ejecucion" | "implementada";

export function MejorasDashboard({ mejorasIniciales, userId, canEditAll, userName, userSector }: Props) {
  const [mejoras, setMejoras] = useState<MejoraConFotos[]>(mejorasIniciales);
  const [yearFilter, setYearFilter] = useState<string>("todos");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MejoraConFotos | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MejoraConFotos | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── derived ──────────────────────────────────────────────────
  const byYear = useMemo(() =>
    yearFilter === "todos" ? mejoras : mejoras.filter((m) => m.created_at.startsWith(yearFilter)),
    [mejoras, yearFilter]);

  const implementadas = useMemo(() => byYear.filter((m) => m.estado === "implementada"), [byYear]);
  const enEjecucion   = useMemo(() => byYear.filter((m) => m.estado === "en_ejecucion"),  [byYear]);

  const sectorCounts = useMemo(() => {
    const c: Record<string, number> = {};
    byYear.forEach((m) => { c[m.sector] = (c[m.sector] ?? 0) + 1; });
    return c;
  }, [byYear]);

  const sectoresSinMejoras = useMemo(
    () => SECTORES.filter((s) => !sectorCounts[s]),
    [sectorCounts]
  );

  const miSectorPendientes = useMemo(() => {
    if (!userSector) return 0;
    return byYear.filter((m) => m.sector === userSector && m.estado === "en_ejecucion").length;
  }, [byYear, userSector]);

  const filtered = useMemo(() => {
    let list = byYear;
    if (estadoFilter !== "all") list = list.filter((m) => m.estado === estadoFilter);
    if (sectorFilter !== "todos") list = list.filter((m) => m.sector === sectorFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.titulo.toLowerCase().includes(q) ||
          m.sector.toLowerCase().includes(q) ||
          (m.area_oportunidad ?? "").toLowerCase().includes(q) ||
          (m.responsable_nombre ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [byYear, estadoFilter, sectorFilter, search]);

  const allSectors = useMemo(
    () => Object.keys(sectorCounts).sort((a, b) => (sectorCounts[b] ?? 0) - (sectorCounts[a] ?? 0)),
    [sectorCounts]
  );

  // ── actions ──────────────────────────────────────────────────
  async function refresh() {
    const res = await fetch("/api/mejoras");
    if (res.ok) setMejoras(await res.json());
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta mejora? No se puede deshacer.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/mejoras/${id}`, { method: "DELETE" });
      setSelected(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  function canEdit(m: MejoraConFotos) {
    return canEditAll || m.created_by === userId;
  }

  // ── render ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Mejora Continua</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro de mejoras por sector</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Registrar mejora
        </Button>
      </div>

      {/* Mi sector banner */}
      {userSector && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Mi sector</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{userSector}</p>
            </div>
          </div>
          {miSectorPendientes > 0 ? (
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{miSectorPendientes}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">En ejecución</p>
              </div>
              <button
                onClick={() => { setSectorFilter(userSector); setEstadoFilter("en_ejecucion"); }}
                className="text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-2 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                Ver las mías <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full px-3 py-1 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Sin pendientes
              </span>
              <button
                onClick={() => { setSectorFilter(userSector); setEstadoFilter("all"); }}
                className="text-xs font-medium text-slate-500 hover:text-green-600 transition-colors flex items-center gap-1"
              >
                Ver todas <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stat tiles — clickeable para filtrar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile
          label="Total"
          value={byYear.length}
          sub={yearFilter === "todos" ? "Todos los años" : `Año ${yearFilter}`}
          color="default"
          active={estadoFilter === "all"}
          onClick={() => setEstadoFilter("all")}
        />
        <StatTile
          label="Implementadas"
          value={implementadas.length}
          sub={`${byYear.length ? Math.round((implementadas.length / byYear.length) * 100) : 0}% del total`}
          color="green"
          active={estadoFilter === "implementada"}
          onClick={() => setEstadoFilter("implementada")}
        />
        <StatTile
          label="En ejecución"
          value={enEjecucion.length}
          sub="En curso"
          color="amber"
          active={estadoFilter === "en_ejecucion"}
          onClick={() => setEstadoFilter("en_ejecucion")}
        />
      </div>

      {/* Sectores sin mejoras */}
      {sectoresSinMejoras.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/30 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Sectores sin mejoras{yearFilter !== "todos" ? ` en ${yearFilter}` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {sectoresSinMejoras.map((s) => (
                <span key={s} className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/30 rounded-full px-2.5 py-0.5 font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 shadow-sm">
        <span className="text-xs font-medium text-slate-500">Año</span>
        <select
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setSectorFilter("todos"); setEstadoFilter("all"); }}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="todos">Todos</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

        <span className="text-xs font-medium text-slate-500">Sector</span>
        <div className="flex gap-1.5 flex-wrap">
          <SectorChip label="Todos" count={byYear.length} active={sectorFilter === "todos"} onClick={() => setSectorFilter("todos")} />
          {allSectors.map((s) => (
            <SectorChip key={s} label={s} count={sectorCounts[s] ?? 0} active={sectorFilter === s} onClick={() => setSectorFilter(s)} />
          ))}
        </div>

        <input
          type="search"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto text-sm border border-slate-200 dark:border-slate-600 rounded-md px-3 py-1.5 w-40 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {/* Estado filter indicator */}
      {estadoFilter !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Mostrando:</span>
          <button
            onClick={() => setEstadoFilter("all")}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border
              ${estadoFilter === "implementada"
                ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-400"
                : "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-400"
              }`}
          >
            {estadoFilter === "implementada" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {estadoFilter === "implementada" ? "Implementadas" : "En ejecución"}
            <X className="h-3 w-3 ml-0.5 opacity-60" />
          </button>
        </div>
      )}

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-slate-500">Sin mejoras registradas</p>
          <p className="text-sm mt-1">
            {search || sectorFilter !== "todos" || estadoFilter !== "all"
              ? "Probá con otros filtros"
              : "Registrá la primera mejora"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MejoraCard key={m.id} mejora={m} onClick={() => setSelected(m)} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {selected && (
            <MejoraDetail
              mejora={selected}
              canEdit={canEdit(selected)}
              onEdit={() => { setEditTarget(selected); setSelected(null); setFormOpen(true); }}
              onDelete={() => handleDelete(selected.id)}
              onClose={() => setSelected(null)}
              onRefresh={refresh}
              deleting={deleting}
            />
          )}
        </DialogContent>
      </Dialog>

      <MejoraFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSaved={async () => { setFormOpen(false); setEditTarget(null); await refresh(); }}
        mejora={editTarget}
        userName={userName}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function StatTile({ label, value, sub, color, active, onClick }: {
  label: string; value: number; sub: string; color: string;
  active: boolean; onClick: () => void;
}) {
  const colors: Record<string, string> = {
    green:   "text-green-600 dark:text-green-400",
    amber:   "text-amber-600 dark:text-amber-400",
    default: "text-slate-800 dark:text-slate-200",
  };
  const activeBorder: Record<string, string> = {
    green:   "border-green-400 dark:border-green-500",
    amber:   "border-amber-400 dark:border-amber-500",
    default: "border-slate-400 dark:border-slate-400",
  };

  return (
    <button
      onClick={onClick}
      className={`text-left bg-white dark:bg-slate-900 border-2 rounded-xl p-4 shadow-sm transition-all cursor-pointer
        ${active
          ? `${activeBorder[color]} shadow-md -translate-y-0.5`
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }
      `}
    >
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${colors[color]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
        {active ? "✓ filtrando" : "clic para filtrar"}
      </p>
    </button>
  );
}

function SectorChip({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all
        ${active
          ? "bg-green-50 border-green-400 text-green-700 dark:bg-green-900/30 dark:border-green-500 dark:text-green-400"
          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-green-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400"
        }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[10px] font-bold
        ${active ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300"}`}>
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  if (estado === "implementada") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700 uppercase tracking-wide">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Implementada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700 uppercase tracking-wide">
      <Clock className="h-2.5 w-2.5" />
      En ejecución
    </span>
  );
}

function MejoraCard({ mejora, onClick }: { mejora: MejoraConFotos; onClick: () => void }) {
  const fotoAntes   = mejora.fotos.find((f) => f.tipo === "antes");
  const fotoDespues = mejora.fotos.find((f) => f.tipo === "despues");

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      {/* Photo strip */}
      <div className="grid grid-cols-[1fr_26px_1fr] h-28">
        <div className="relative overflow-hidden">
          {fotoAntes
            ? <img src={fotoAntes.url} alt="Antes" className="w-full h-full object-cover" />
            : <PlaceholderPhoto label="Antes" />}
          <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] font-bold uppercase tracking-widest text-center py-0.5">Antes</div>
        </div>
        <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-800 border-x border-slate-200 dark:border-slate-700">
          <ChevronRight className="h-3 w-3 text-slate-400" />
        </div>
        <div className="relative overflow-hidden">
          {fotoDespues
            ? <img src={fotoDespues.url} alt="Después" className="w-full h-full object-cover" />
            : <PlaceholderPhoto label="Después" />}
          <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] font-bold uppercase tracking-widest text-center py-0.5">Después</div>
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-slate-400">{mejora.numero}</span>
          <StatusBadge estado={mejora.estado} />
        </div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 mb-2">
          {mejora.titulo}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded px-2 py-0.5 font-medium">
            {mejora.sector}
          </span>
          {mejora.area_oportunidad && (
            <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 rounded px-2 py-0.5">
              {mejora.area_oportunidad}
            </span>
          )}
          <span className="text-[10px] text-slate-400 ml-auto">{fdate(mejora.created_at.split("T")[0])}</span>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPhoto({ label }: { label: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-100 dark:bg-slate-800">
      <Camera className="h-4 w-4 text-slate-300 dark:text-slate-600" />
      <span className="text-[9px] text-slate-400">{label}</span>
    </div>
  );
}

// ── Detail ────────────────────────────────────────────────────

function MejoraDetail({ mejora, canEdit, onEdit, onDelete, onClose, onRefresh, deleting }: {
  mejora: MejoraConFotos; canEdit: boolean;
  onEdit: () => void; onDelete: () => void; onClose: () => void;
  onRefresh: () => Promise<void>; deleting: boolean;
}) {
  const [uploadingTipo, setUploadingTipo] = useState<"antes" | "despues" | null>(null);
  const [deletingFoto, setDeletingFoto] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const fotosAntes   = mejora.fotos.filter((f) => f.tipo === "antes");
  const fotosDespues = mejora.fotos.filter((f) => f.tipo === "despues");

  async function uploadFoto(tipo: "antes" | "despues", file: File) {
    setUploadingTipo(tipo);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("mejora_id", mejora.id); fd.append("tipo", tipo);
      await fetch("/api/mejoras/fotos", { method: "POST", body: fd });
      await onRefresh();
    } finally { setUploadingTipo(null); }
  }

  async function deleteFoto(id: string) {
    if (!confirm("¿Eliminar esta foto?")) return;
    setDeletingFoto(id);
    try {
      await fetch(`/api/mejoras/fotos/${id}`, { method: "DELETE" });
      await onRefresh();
    } finally { setDeletingFoto(null); }
  }

  return (
    <div>
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Ampliada" className="max-w-full max-h-full rounded-lg" />
          <button className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full p-2" onClick={() => setLightbox(null)}>
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
        <p className="text-xs font-mono text-slate-400 mb-1">{mejora.numero}</p>
        <DialogTitle className="text-lg font-bold leading-snug pr-8 mb-3">{mejora.titulo}</DialogTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge estado={mejora.estado} />
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full px-2.5 py-0.5 font-medium">{mejora.sector}</span>
          {mejora.area_oportunidad && (
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full px-2.5 py-0.5">{mejora.area_oportunidad}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">

        {/* Before / After */}
        <div>
          <SectionTitle>Antes y después</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_32px_1fr] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <BACol tipo="antes" label="Antes" fotos={fotosAntes} desc={mejora.situacion_antes}
              canEdit={canEdit} uploading={uploadingTipo === "antes"} deletingFoto={deletingFoto}
              onUpload={(f) => uploadFoto("antes", f)} onDelete={deleteFoto} onLightbox={setLightbox} />
            <div className="hidden sm:flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 border-x border-slate-200 dark:border-slate-700">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-full w-7 h-7 flex items-center justify-center shadow-sm">
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
            <BACol tipo="despues" label="Después" fotos={fotosDespues} desc={mejora.situacion_despues}
              canEdit={canEdit} uploading={uploadingTipo === "despues"} deletingFoto={deletingFoto}
              onUpload={(f) => uploadFoto("despues", f)} onDelete={deleteFoto} onLightbox={setLightbox} />
          </div>
        </div>

        {/* Fields */}
        <div>
          <SectionTitle>Información</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Responsable" value={mejora.responsable_nombre} />
            <Field label="Sector" value={mejora.sector} />
            <Field label="Máquina / equipo" value={mejora.maquina_equipo} />
            <Field label="Fecha registro" value={fdate(mejora.created_at.split("T")[0])} />
            <Field label="Fecha implementación" value={fdate(mejora.fecha_implementacion)} />
            {mejora.creador && <Field label="Registrado por" value={(mejora.creador as { nombre: string }).nombre} />}
          </div>
        </div>

        {mejora.accion_tomada    && <Section title="Acción tomada">{mejora.accion_tomada}</Section>}
        {mejora.causa_descripcion && <Section title="Causa del cambio">{mejora.causa_descripcion}</Section>}
        {mejora.resultado_cambio  && <Section title="Resultado">{mejora.resultado_cambio}</Section>}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        {canEdit && (
          <>
            <Button variant="outline" size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              onClick={onDelete} disabled={deleting}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />{deleting ? "Eliminando…" : "Eliminar"}
            </Button>
            <Button size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1" />Editar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function BACol({ tipo, label, fotos, desc, canEdit, uploading, deletingFoto, onUpload, onDelete, onLightbox }: {
  tipo: "antes" | "despues"; label: string;
  fotos: MejoraConFotos["fotos"]; desc: string | null;
  canEdit: boolean; uploading: boolean; deletingFoto: string | null;
  onUpload: (f: File) => void; onDelete: (id: string) => void; onLightbox: (url: string) => void;
}) {
  const hdrCls = tipo === "antes"
    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-700/30"
    : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-b border-green-200 dark:border-green-700/30";

  return (
    <div className="flex flex-col">
      <div className={`px-3 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${hdrCls}`}>
        {tipo === "antes" ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
        {label}
      </div>
      {fotos.length > 0 && (
        <div className={`grid gap-0.5 p-1.5 bg-slate-50 dark:bg-slate-800/50 ${fotos.length > 1 ? "grid-cols-2" : ""}`}>
          {fotos.map((f) => (
            <div key={f.id} className="relative group aspect-video overflow-hidden rounded">
              <img src={f.url} alt={f.nombre_archivo} className="w-full h-full object-cover cursor-zoom-in" onClick={() => onLightbox(f.url)} />
              {canEdit && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(f.id); }} disabled={deletingFoto === f.id}
                  className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {fotos.length === 0 && (
        <div className="flex items-center justify-center h-20 bg-slate-50 dark:bg-slate-800/40">
          <Camera className="h-5 w-5 text-slate-300 dark:text-slate-600" />
        </div>
      )}
      {canEdit && (
        <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700">
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="sr-only" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
            <span className="text-xs text-slate-500 hover:text-green-600 flex items-center gap-1 transition-colors">
              <Plus className="h-3 w-3" />{uploading ? "Subiendo…" : "Agregar foto"}
            </span>
          </label>
        </div>
      )}
      {desc && <div className="px-3 pb-3 pt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">{desc}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{children}</p>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3.5 py-3">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value || "—"}</p>
    </div>
  );
}
