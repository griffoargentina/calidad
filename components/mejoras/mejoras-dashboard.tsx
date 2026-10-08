"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, TrendingUp, AlertTriangle, Camera, ChevronRight,
  CheckCircle2, Clock, Pencil, Trash2, X,
} from "lucide-react";
import { MejoraConFotos, SECTORES } from "@/types/mejora";
import { MejoraFormDialog } from "./mejora-form-dialog";

interface Props {
  mejorasIniciales: MejoraConFotos[];
  userId: string;
  canEditAll: boolean;
  userName: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function PhotoThumb({ url, alt }: { url: string; alt: string }) {
  return (
    <img
      src={url}
      alt={alt}
      className="w-full h-full object-cover"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function NoPhoto({ label }: { label: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-100 dark:bg-slate-800">
      <Camera className="h-5 w-5 text-slate-300 dark:text-slate-600" />
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}

export function MejorasDashboard({ mejorasIniciales, userId, canEditAll, userName }: Props) {
  const [mejoras, setMejoras] = useState<MejoraConFotos[]>(mejorasIniciales);
  const [yearFilter, setYearFilter] = useState<string>("todos");
  const [sectorFilter, setSectorFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MejoraConFotos | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MejoraConFotos | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Derived data ───────────────────────────────────────
  const mejoras_year = useMemo(() => {
    if (yearFilter === "todos") return mejoras;
    return mejoras.filter((m) => m.created_at.startsWith(yearFilter));
  }, [mejoras, yearFilter]);

  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    mejoras_year.forEach((m) => {
      counts[m.sector] = (counts[m.sector] ?? 0) + 1;
    });
    return counts;
  }, [mejoras_year]);

  const sectoresConMejoras = useMemo(() => new Set(Object.keys(sectorCounts)), [sectorCounts]);

  const sectoresSinMejoras = useMemo(
    () => SECTORES.filter((s) => !sectoresConMejoras.has(s)),
    [sectoresConMejoras]
  );

  const topSector = useMemo(() => {
    const entries = Object.entries(sectorCounts);
    if (!entries.length) return null;
    return entries.sort((a, b) => b[1] - a[1])[0];
  }, [sectorCounts]);

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return mejoras.filter((m) => m.created_at.startsWith(prefix)).length;
  }, [mejoras]);

  const filtered = useMemo(() => {
    let list = mejoras_year;
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
  }, [mejoras_year, sectorFilter, search]);

  // ─── Actions ────────────────────────────────────────────
  async function refresh() {
    const res = await fetch("/api/mejoras");
    if (res.ok) setMejoras(await res.json());
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta mejora? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/mejoras/${id}`, { method: "DELETE" });
      setSelected(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  function canEditMejora(m: MejoraConFotos) {
    return canEditAll || m.created_by === userId;
  }

  // ─── Render ─────────────────────────────────────────────
  const allSectoresInYear = Object.keys(sectorCounts).sort((a, b) => (sectorCounts[b] ?? 0) - (sectorCounts[a] ?? 0));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Mejora Continua</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kaizen — registro de mejoras por sector</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nueva mejora
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total mejoras" value={mejoras.length} sub="Desde el inicio" color="green" />
        <StatTile label={`Año ${yearFilter === "todos" ? CURRENT_YEAR : yearFilter}`}
          value={mejoras_year.length} sub={yearFilter === "todos" ? String(CURRENT_YEAR) : `${yearFilter}`} color="blue" />
        <StatTile
          label="Sector más activo"
          value={topSector ? topSector[1] : 0}
          sub={topSector ? topSector[0] : "—"}
          color="amber"
        />
        <StatTile label="Este mes" value={thisMonthCount} sub="Registradas" color="default" />
      </div>

      {/* Sectores sin mejoras warning */}
      {sectoresSinMejoras.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/40 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Sectores sin mejoras{yearFilter !== "todos" ? ` en ${yearFilter}` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {sectoresSinMejoras.map((s) => (
                <span key={s} className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/40 rounded-full px-2.5 py-0.5 font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Año</span>
          <select
            value={yearFilter}
            onChange={(e) => { setYearFilter(e.target.value); setSectorFilter("todos"); }}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="todos">Todos</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-500">Sector</span>
          <SectorChip
            label="Todos"
            count={mejoras_year.length}
            active={sectorFilter === "todos"}
            onClick={() => setSectorFilter("todos")}
          />
          {allSectoresInYear.map((s) => (
            <SectorChip
              key={s}
              label={s}
              count={sectorCounts[s] ?? 0}
              active={sectorFilter === s}
              onClick={() => setSectorFilter(s)}
            />
          ))}
        </div>

        <div className="ml-auto">
          <input
            type="search"
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-md px-3 py-1.5 w-44 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-slate-500">Sin mejoras registradas</p>
          <p className="text-sm mt-1">
            {search || sectorFilter !== "todos" ? "Probá con otros filtros" : "Registrá la primera mejora"}
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
              canEdit={canEditMejora(selected)}
              onEdit={() => { setEditTarget(selected); setSelected(null); setFormOpen(true); }}
              onDelete={() => handleDelete(selected.id)}
              onClose={() => setSelected(null)}
              onRefresh={async () => { await refresh(); }}
              deleting={deleting}
              userId={userId}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit form */}
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

// ─── Sub-components ──────────────────────────────────────

function StatTile({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  const colors: Record<string, string> = {
    green: "text-green-600 dark:text-green-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    default: "text-slate-800 dark:text-slate-200",
  };
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${colors[color] ?? colors.default}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function SectorChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all
        ${active
          ? "bg-green-50 border-green-400 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-400"
          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-green-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400"
        }`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold
        ${active ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300"}`}>
        {count}
      </span>
    </button>
  );
}

function MejoraCard({ mejora, onClick }: { mejora: MejoraConFotos; onClick: () => void }) {
  const fotoAntes = mejora.fotos.find((f) => f.tipo === "antes");
  const fotoDespues = mejora.fotos.find((f) => f.tipo === "despues");

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      {/* Photo strip */}
      <div className="grid grid-cols-[1fr_28px_1fr] h-32">
        <div className="relative overflow-hidden">
          {fotoAntes ? <PhotoThumb url={fotoAntes.url} alt="Antes" /> : <NoPhoto label="Antes" />}
          <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] font-bold uppercase tracking-widest text-center py-0.5">
            Antes
          </div>
        </div>
        <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-800 border-x border-slate-200 dark:border-slate-700">
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        </div>
        <div className="relative overflow-hidden">
          {fotoDespues ? <PhotoThumb url={fotoDespues.url} alt="Después" /> : <NoPhoto label="Después" />}
          <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] font-bold uppercase tracking-widest text-center py-0.5">
            Después
          </div>
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
          <span className="text-[10px] text-slate-400 ml-auto">{formatDate(mejora.created_at.split("T")[0])}</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  if (estado === "implementada") {
    return (
      <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700">
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
        Implementada
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400">
      <Clock className="h-2.5 w-2.5 mr-0.5" />
      En proceso
    </Badge>
  );
}

// ─── Detail view ─────────────────────────────────────────

interface DetailProps {
  mejora: MejoraConFotos;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  deleting: boolean;
  userId: string;
}

function MejoraDetail({ mejora, canEdit, onEdit, onDelete, onClose, onRefresh, deleting, userId }: DetailProps) {
  const [uploadingTipo, setUploadingTipo] = useState<"antes" | "despues" | null>(null);
  const [deletingFoto, setDeletingFoto] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const fotosAntes = mejora.fotos.filter((f) => f.tipo === "antes");
  const fotosDespues = mejora.fotos.filter((f) => f.tipo === "despues");

  async function uploadFoto(tipo: "antes" | "despues", file: File) {
    setUploadingTipo(tipo);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mejora_id", mejora.id);
      fd.append("tipo", tipo);
      await fetch("/api/mejoras/fotos", { method: "POST", body: fd });
      await onRefresh();
    } finally {
      setUploadingTipo(null);
    }
  }

  async function deleteFoto(id: string) {
    if (!confirm("¿Eliminar esta foto?")) return;
    setDeletingFoto(id);
    try {
      await fetch(`/api/mejoras/fotos/${id}`, { method: "DELETE" });
      await onRefresh();
    } finally {
      setDeletingFoto(null);
    }
  }

  return (
    <div>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Foto ampliada" className="max-w-full max-h-full rounded-lg" />
          <button
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full p-2"
            onClick={() => setLightbox(null)}
          >
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
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full px-2.5 py-0.5 font-medium">
            {mejora.sector}
          </span>
          {mejora.area_oportunidad && (
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full px-2.5 py-0.5">
              {mejora.area_oportunidad}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">

        {/* Before / After strip */}
        <div>
          <SectionTitle>Estado antes y después</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_32px_1fr] gap-0 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <BACol
              tipo="antes"
              label="Antes"
              fotos={fotosAntes}
              descripcion={mejora.situacion_antes}
              canEdit={canEdit}
              uploading={uploadingTipo === "antes"}
              deletingFoto={deletingFoto}
              onUpload={(f) => uploadFoto("antes", f)}
              onDelete={deleteFoto}
              onLightbox={setLightbox}
            />
            <div className="hidden sm:flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 border-x border-slate-200 dark:border-slate-700">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-full w-7 h-7 flex items-center justify-center shadow-sm">
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
            <BACol
              tipo="despues"
              label="Después"
              fotos={fotosDespues}
              descripcion={mejora.situacion_despues}
              canEdit={canEdit}
              uploading={uploadingTipo === "despues"}
              deletingFoto={deletingFoto}
              onUpload={(f) => uploadFoto("despues", f)}
              onDelete={deleteFoto}
              onLightbox={setLightbox}
            />
          </div>
        </div>

        {/* Meta fields */}
        <div>
          <SectionTitle>Información</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Responsable" value={mejora.responsable_nombre} />
            <Field label="Sector" value={mejora.sector} />
            <Field label="Máquina / equipo" value={mejora.maquina_equipo} />
            <Field label="Fecha registro" value={formatDate(mejora.created_at.split("T")[0])} />
            <Field label="Fecha implementación" value={formatDate(mejora.fecha_implementacion)} />
            {mejora.creador && <Field label="Registrado por" value={(mejora.creador as { id: string; nombre: string }).nombre} />}
          </div>
        </div>

        {mejora.accion_tomada && (
          <div>
            <SectionTitle>Acción tomada</SectionTitle>
            <TextBlock>{mejora.accion_tomada}</TextBlock>
          </div>
        )}

        {mejora.causa_descripcion && (
          <div>
            <SectionTitle>Causa / descripción del cambio</SectionTitle>
            <TextBlock>{mejora.causa_descripcion}</TextBlock>
          </div>
        )}

        {mejora.resultado_cambio && (
          <div>
            <SectionTitle>Resultado del cambio</SectionTitle>
            <TextBlock>{mejora.resultado_cambio}</TextBlock>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        {canEdit && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              onClick={onDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
            <Button size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Editar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function BACol({
  tipo, label, fotos, descripcion, canEdit, uploading, deletingFoto,
  onUpload, onDelete, onLightbox,
}: {
  tipo: "antes" | "despues";
  label: string;
  fotos: MejoraConFotos["fotos"];
  descripcion: string | null;
  canEdit: boolean;
  uploading: boolean;
  deletingFoto: string | null;
  onUpload: (f: File) => void;
  onDelete: (id: string) => void;
  onLightbox: (url: string) => void;
}) {
  const headerClass = tipo === "antes"
    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-700/40"
    : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-b border-green-200 dark:border-green-700/40";

  return (
    <div className="flex flex-col">
      <div className={`px-3 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${headerClass}`}>
        {tipo === "antes"
          ? <AlertTriangle className="h-3 w-3" />
          : <CheckCircle2 className="h-3 w-3" />}
        {label}
      </div>

      {/* Photos */}
      {fotos.length > 0 && (
        <div className={`grid gap-0.5 p-1.5 bg-slate-50 dark:bg-slate-800/50 ${fotos.length > 1 ? "grid-cols-2" : ""}`}>
          {fotos.map((f) => (
            <div key={f.id} className="relative group aspect-video overflow-hidden rounded">
              <img
                src={f.url}
                alt={f.nombre_archivo}
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => onLightbox(f.url)}
              />
              {canEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
                  disabled={deletingFoto === f.id}
                  className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {fotos.length === 0 && (
        <div className="flex items-center justify-center h-24 bg-slate-50 dark:bg-slate-800/40">
          <Camera className="h-6 w-6 text-slate-300 dark:text-slate-600" />
        </div>
      )}

      {/* Upload btn */}
      {canEdit && (
        <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
            <span className="text-xs text-slate-500 hover:text-green-600 flex items-center gap-1 transition-colors">
              <Plus className="h-3 w-3" />
              {uploading ? "Subiendo…" : "Agregar foto"}
            </span>
          </label>
        </div>
      )}

      {/* Text */}
      {descripcion && (
        <div className="px-3 pb-3 pt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
          {descripcion}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{children}</p>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
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

function TextBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3.5 py-3">
      {children}
    </div>
  );
}
