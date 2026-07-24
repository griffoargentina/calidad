"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectorFormDialog } from "@/components/procesos/sector-form-dialog";
import { FlujogramaFormDialog } from "@/components/procesos/flujograma-form-dialog";
import { InstructivoFormDialog } from "@/components/procesos/instructivo-form-dialog";
import { RevisarInstructivoModal } from "@/components/procesos/revisar-instructivo-modal";
import { AprobarInstructivoModal } from "@/components/procesos/aprobar-instructivo-modal";
import { formatFecha } from "@/lib/utils/format";
import {
  ArrowLeft, Plus, Pencil, Loader2, GitBranch, FileText, Network,
  Lock, ExternalLink, CheckCircle2, Clock, XCircle, Archive,
} from "lucide-react";
import Link from "next/link";

interface Responsable { id: string; nombre: string }
interface Flujograma {
  id: string; nombre: string; version: number; estado: string; created_at: string; updated_at: string;
  codigo?: string | null; tipo_doc_id?: string | null;
}
interface Instructivo {
  id: string; nombre: string; version: number; estado: string;
  responsable_id: string | null; ultima_revision: string | null; proxima_revision: string | null;
  es_publico: boolean; url_archivo: string | null; nombre_archivo: string | null;
  codigo?: string | null; tipo_doc_id?: string | null;
}
interface Sector {
  id: string; nombre: string; descripcion: string | null; privado: boolean; orden: number;
  abreviatura?: string | null;
  responsables: Responsable[];
  flujogramas: Flujograma[];
  instructivos: Instructivo[];
}
interface ParticipaPaso {
  sector_nombre: string; flujograma_id: string; flujograma_nombre: string;
  paso_id: string; paso_nombre: string; sector_id: string;
}

const ESTADO_INST_COLORS: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-600",
  vigente: "bg-green-100 text-green-700",
  pendiente_aprobacion: "bg-amber-100 text-amber-700",
  rechazado: "bg-red-100 text-red-700",
  historico: "bg-gray-100 text-gray-500",
};
const ESTADO_INST_LABELS: Record<string, string> = {
  borrador: "Borrador",
  vigente: "Vigente",
  pendiente_aprobacion: "Pendiente aprobación",
  rechazado: "Rechazado",
  historico: "Histórico",
};
const ESTADO_FLUJ_COLORS: Record<string, string> = {
  vigente: "bg-green-100 text-green-700",
  borrador: "bg-slate-100 text-slate-600",
  historico: "bg-gray-100 text-gray-500",
};

type Tab = "flujogramas" | "instructivos" | "participa";

function EstadoInstIcon({ estado }: { estado: string }) {
  if (estado === "vigente") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
  if (estado === "pendiente_aprobacion") return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  if (estado === "rechazado") return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  if (estado === "borrador") return <FileText className="h-3.5 w-3.5 text-slate-400" />;
  return <Archive className="h-3.5 w-3.5 text-gray-400" />;
}

export default function SectorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sectorId = params.id as string;

  const [sector, setSector] = useState<Sector | null>(null);
  const [participa, setParticipa] = useState<ParticipaPaso[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRol, setUserRol] = useState("lector");
  const [usuarios, setUsuarios] = useState<Array<{ id: string; nombre: string }>>([]);
  const [activeTab, setActiveTab] = useState<Tab>("flujogramas");

  // Dialog states
  const [showEditSector, setShowEditSector] = useState(false);
  const [showAddFlujograma, setShowAddFlujograma] = useState(false);
  const [showAddInstructivo, setShowAddInstructivo] = useState(false);
  const [revisarInstructivo, setRevisarInstructivo] = useState<Instructivo | null>(null);
  const [aprobarInstructivo, setAprobarInstructivo] = useState<Instructivo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/procesos/sectores/${sectorId}`);
    if (!res.ok) { router.push("/procesos"); return; }
    const data: Sector = await res.json();
    setSector(data);

    // Load "participa en" — steps from other sectors where this sector appears
    await loadParticipa(sectorId);
    setLoading(false);
  }, [sectorId, router]);

  async function loadParticipa(sid: string) {
    // Get all paso_sectores where sector_id = this sector
    const res = await fetch(`/api/procesos/sectores/${sid}`);
    if (!res.ok) return;
    // We derive "participa" from the sector data's instructivos and a dedicated query
    // For now, fetch all paso_sectores and join manually
    const supabase = createClient();
    const { data: pasoSectores } = await supabase
      .from("proc_paso_sectores")
      .select("paso_id, paso:proc_pasos(id, nombre, flujograma_id, flujograma:proc_flujogramas(id, nombre, sector_id, sector:proc_sectores(id, nombre)))")
      .eq("sector_id", sid);

    const items: ParticipaPaso[] = [];
    for (const ps of pasoSectores ?? []) {
      const paso = Array.isArray(ps.paso) ? ps.paso[0] : ps.paso;
      if (!paso) continue;
      const flujo = Array.isArray(paso.flujograma) ? paso.flujograma[0] : paso.flujograma;
      if (!flujo) continue;
      // Only include if the flujograma belongs to a DIFFERENT sector
      if (flujo.sector_id === sid) continue;
      const sec = Array.isArray(flujo.sector) ? flujo.sector[0] : flujo.sector;
      items.push({
        sector_id: flujo.sector_id,
        sector_nombre: sec?.nombre ?? "—",
        flujograma_id: flujo.id,
        flujograma_nombre: flujo.nombre,
        paso_id: paso.id,
        paso_nombre: paso.nombre,
      });
    }
    setParticipa(items);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
      setUserRol(data?.rol ?? "lector");
    });
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre").then(({ data }) => {
      setUsuarios(data ?? []);
    });
  }, [load]);

  const isAdmin = userRol === "admin";
  const canEdit = ["admin", "editor"].includes(userRol);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Procesos" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!sector) return null;

  return (
    <div className="flex flex-col h-full">
      <Topbar title={`Procesos — ${sector.nombre}`} />

      <div className="flex-1 overflow-y-auto">
        {/* Sector header */}
        <div className="border-b bg-white px-6 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => router.push("/procesos")}>
              <ArrowLeft className="h-4 w-4 mr-1" />Procesos
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{sector.nombre}</h1>
                {sector.privado ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                    <Lock className="h-3 w-3" />Privado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                    Público
                  </span>
                )}
              </div>
              {sector.descripcion && (
                <p className="text-sm text-muted-foreground">{sector.descripcion}</p>
              )}
              {sector.responsables.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">Responsables:</span>
                  {sector.responsables.map((r) => (
                    <span key={r.id} className="text-xs font-medium">{r.nombre}</span>
                  ))}
                </div>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-2 flex-wrap">
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setShowEditSector(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Editar sector
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setShowAddFlujograma(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Flujograma
                </Button>
                <Button size="sm" onClick={() => setShowAddInstructivo(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Instructivo
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b px-6 flex gap-0">
          {(["flujogramas", "instructivos", "participa"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "flujogramas" && <><GitBranch className="inline h-3.5 w-3.5 mr-1.5" />Flujogramas ({sector.flujogramas.length})</>}
              {tab === "instructivos" && <><FileText className="inline h-3.5 w-3.5 mr-1.5" />Instructivos ({sector.instructivos.length})</>}
              {tab === "participa" && <><Network className="inline h-3.5 w-3.5 mr-1.5" />Participa en ({participa.length})</>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === "flujogramas" && (
            <div className="space-y-3">
              {sector.flujogramas.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                  <GitBranch className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No hay flujogramas en este sector.</p>
                  {canEdit && <p className="text-xs">Hacé clic en &quot;Flujograma&quot; para crear el primero.</p>}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sector.flujogramas.map((f) => (
                    <div key={f.id} className="border rounded-lg p-4 bg-white space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {f.codigo && <span className="font-mono text-xs text-blue-600 font-medium">{f.codigo}</span>}
                          <p className="font-medium text-sm">{f.nombre}</p>
                          <p className="text-xs text-muted-foreground">v{f.version}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_FLUJ_COLORS[f.estado] ?? "bg-gray-100 text-gray-500"}`}>
                          {f.estado}
                        </span>
                      </div>
                      <Link href={`/procesos/${sectorId}/flujograma/${f.id}`}>
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs">
                          Ver / Editar
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "instructivos" && (
            <div className="overflow-x-auto">
              {sector.instructivos.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                  <FileText className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No hay instructivos en este sector.</p>
                  {canEdit && <p className="text-xs">Hacé clic en &quot;Instructivo&quot; para agregar el primero.</p>}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-20">Ver.</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-40">Estado</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-32">Últ. revisión</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-32">Próx. revisión</th>
                      <th className="px-3 py-2.5 w-40"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sector.instructivos.map((inst) => (
                      <tr key={inst.id} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <EstadoInstIcon estado={inst.estado} />
                            <div>
                              {inst.codigo && <span className="font-mono text-xs text-blue-600 font-medium block">{inst.codigo}</span>}
                              <span className="font-medium">{inst.nombre}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground font-mono">v{inst.version}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_INST_COLORS[inst.estado] ?? ""}`}>
                            {ESTADO_INST_LABELS[inst.estado] ?? inst.estado}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {inst.ultima_revision ? formatFecha(inst.ultima_revision) : "—"}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {inst.proxima_revision ? formatFecha(inst.proxima_revision) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {inst.url_archivo && (
                              <a href={inst.url_archivo} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                  <ExternalLink className="h-3 w-3 mr-1" />Ver
                                </Button>
                              </a>
                            )}
                            {canEdit && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                onClick={() => setRevisarInstructivo(inst)}>
                                Revisar
                              </Button>
                            )}
                            {isAdmin && inst.estado === "borrador" && (
                              <Button size="sm" variant="outline"
                                className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
                                onClick={async () => {
                                  await fetch(`/api/procesos/instructivos/${inst.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ estado: "vigente" }),
                                  });
                                  load();
                                }}>
                                Activar
                              </Button>
                            )}
                            {isAdmin && inst.estado === "pendiente_aprobacion" && (
                              <Button size="sm" variant="outline"
                                className="h-7 px-2 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                                onClick={() => setAprobarInstructivo(inst)}>
                                Aprobar
                              </Button>
                            )}
                            {isAdmin && inst.estado === "rechazado" && (
                              <Button size="sm" variant="outline"
                                className="h-7 px-2 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                                onClick={() => setAprobarInstructivo(inst)}>
                                Revisar aprobación
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "participa" && (
            <div className="space-y-2">
              {participa.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                  <Network className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Este sector no participa en flujogramas de otros sectores.</p>
                </div>
              ) : (
                participa.map((p) => (
                  <div key={p.paso_id} className="border rounded-lg px-4 py-3 bg-white flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-[10px]">{p.sector_nombre}</Badge>
                        <span className="text-muted-foreground">›</span>
                        <span className="font-medium">{p.flujograma_nombre}</span>
                        <span className="text-muted-foreground">›</span>
                        <span className="text-muted-foreground text-xs">{p.paso_nombre}</span>
                      </div>
                    </div>
                    <Link href={`/procesos/${p.sector_id}/flujograma/${p.flujograma_id}`}>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0">
                        <ExternalLink className="h-3 w-3 mr-1" />Ver
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {isAdmin && (
        <SectorFormDialog
          open={showEditSector}
          onOpenChange={setShowEditSector}
          onSuccess={load}
          sector={sector}
          usuarios={usuarios}
        />
      )}
      <FlujogramaFormDialog
        open={showAddFlujograma}
        onOpenChange={setShowAddFlujograma}
        onSuccess={load}
        sectorId={sectorId}
        sectorAbreviatura={sector?.abreviatura ?? null}
      />
      <InstructivoFormDialog
        open={showAddInstructivo}
        onOpenChange={setShowAddInstructivo}
        onSuccess={load}
        sectorId={sectorId}
        usuarios={usuarios}
      />
      {revisarInstructivo && (
        <RevisarInstructivoModal
          open={revisarInstructivo !== null}
          onOpenChange={(open: boolean) => { if (!open) setRevisarInstructivo(null); }}
          onSuccess={load}
          instructivo={revisarInstructivo}
        />
      )}
      {aprobarInstructivo && isAdmin && (
        <AprobarInstructivoModal
          open={aprobarInstructivo !== null}
          onOpenChange={(open: boolean) => { if (!open) setAprobarInstructivo(null); }}
          onSuccess={load}
          instructivo={aprobarInstructivo}
        />
      )}
    </div>
  );
}
