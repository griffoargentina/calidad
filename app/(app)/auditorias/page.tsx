"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuditoriaFormDialog, type Auditoria } from "@/components/auditorias/auditoria-form-dialog";
import { CompletarAuditoriaModal } from "@/components/auditorias/completar-auditoria-modal";
import { formatFecha } from "@/lib/utils/format";
import { ClipboardCheck, Plus, Edit2, Trash2, ExternalLink, Loader2, RefreshCw, FileCheck } from "lucide-react";

const TIPO_COLORS: Record<string, string> = {
  interna: "bg-blue-100 text-blue-700",
  externa: "bg-purple-100 text-purple-700",
  proveedor: "bg-orange-100 text-orange-700",
  proceso: "bg-green-100 text-green-700",
};
const TIPO_LABELS: Record<string, string> = {
  interna: "Interna", externa: "Externa", proveedor: "Proveedor", proceso: "Proceso",
};
const ESTADO_COLORS: Record<string, string> = {
  programada: "bg-slate-100 text-slate-600",
  en_curso: "bg-blue-100 text-blue-700",
  completada: "bg-green-100 text-green-700",
  vencida: "bg-red-100 text-red-700",
};
const ESTADO_LABELS: Record<string, string> = {
  programada: "Programada", en_curso: "En curso", completada: "Completada", vencida: "Vencida",
};
const FRECUENCIA_LABELS: Record<number, string> = {
  30: "Mensual", 60: "Bimestral", 90: "Trimestral", 180: "Semestral", 365: "Anual",
};

type RelField = { id: string; nombre: string } | { id: string; nombre: string }[] | null | undefined;
function getNombre(field: RelField): string {
  if (!field) return "—";
  const obj = Array.isArray(field) ? field[0] : field;
  return obj?.nombre ?? "—";
}

export default function AuditoriasPage() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [areas, setAreas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [usuarios, setUsuarios] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [showForm, setShowForm] = useState(false);
  const [editAuditoria, setEditAuditoria] = useState<Auditoria | null>(null);
  const [completarAuditoria, setCompletarAuditoria] = useState<Auditoria | null>(null);
  const [showCompletar, setShowCompletar] = useState(false);
  const [userRol, setUserRol] = useState("lector");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/auditorias");
    const data = await res.json();
    setAuditorias(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    Promise.all([
      supabase.from("areas").select("id, nombre").eq("activa", true).order("nombre"),
      supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
    ]).then(([areasRes, usuariosRes]) => {
      setAreas(areasRes.data ?? []);
      setUsuarios(usuariosRes.data ?? []);
    });
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
      setUserRol(data?.rol ?? "lector");
    });
  }, [load]);

  const filtered = auditorias.filter((a) => {
    if (tipoFilter !== "todos" && a.tipo !== tipoFilter) return false;
    if (estadoFilter !== "todos" && a.estado !== estadoFilter) return false;
    return true;
  });

  const stats = {
    total: auditorias.length,
    programadas: auditorias.filter(a => a.estado === "programada").length,
    enCurso: auditorias.filter(a => a.estado === "en_curso").length,
    completadas: auditorias.filter(a => a.estado === "completada").length,
    vencidas: auditorias.filter(a => a.estado === "vencida").length,
  };

  const canEdit = userRol !== "lector";
  const isAdmin = userRol === "admin";

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta auditoría?")) return;
    await fetch(`/api/auditorias/${id}`, { method: "DELETE" });
    load();
  }

  async function handleEnCurso(id: string) {
    await fetch(`/api/auditorias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "en_curso" }),
    });
    load();
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Plan de Auditoría"
        actions={canEdit ? (
          <Button size="sm" onClick={() => { setEditAuditoria(null); setShowForm(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />Nueva auditoría
          </Button>
        ) : undefined}
      />
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, cls: "" },
            { label: "Programadas", value: stats.programadas, cls: "" },
            { label: "En curso", value: stats.enCurso, cls: "text-blue-600" },
            { label: "Completadas", value: stats.completadas, cls: "text-green-600" },
            { label: "Vencidas", value: stats.vencidas, cls: "text-red-600", alert: stats.vencidas > 0 },
          ].map((s) => (
            <Card key={s.label} className={s.alert ? "border-red-200" : ""}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {["todos", "interna", "externa", "proveedor", "proceso"].map((t) => (
            <button key={t} onClick={() => setTipoFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                tipoFilter === t ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"
              }`}>
              {t === "todos" ? "Todos los tipos" : TIPO_LABELS[t]}
            </button>
          ))}
          <div className="w-px bg-border mx-1" />
          {["todos", "programada", "en_curso", "completada", "vencida"].map((e) => (
            <button key={e} onClick={() => setEstadoFilter(e)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                estadoFilter === e ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"
              }`}>
              {e === "todos" ? "Todos los estados" : ESTADO_LABELS[e]}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2 text-muted-foreground">
                <ClipboardCheck className="h-10 w-10 opacity-30" />
                <p className="text-sm">No hay auditorías con estos filtros</p>
                {canEdit && (
                  <Button variant="outline" size="sm" className="mt-2"
                    onClick={() => { setEditAuditoria(null); setShowForm(true); }}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Nueva auditoría
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Título / proceso</TableHead>
                    <TableHead className="w-24">Tipo</TableHead>
                    <TableHead className="w-36">Responsable</TableHead>
                    <TableHead className="w-28">Vence</TableHead>
                    <TableHead className="w-28">Estado</TableHead>
                    <TableHead className="w-24 text-center">NC M/m/O</TableHead>
                    <TableHead className="w-36"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id} className={a.estado === "vencida" ? "bg-red-50/40" : ""}>
                      <TableCell>
                        <p className="text-sm font-medium">{a.titulo}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {a.norma && <span className="text-xs text-muted-foreground">{a.norma}</span>}
                          {a.frecuencia_dias && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <RefreshCw className="h-2.5 w-2.5" />
                              {FRECUENCIA_LABELS[a.frecuencia_dias] ?? `${a.frecuencia_dias}d`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[a.tipo]}`}>
                          {TIPO_LABELS[a.tipo]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{getNombre(a.responsable)}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm ${a.estado === "vencida" ? "text-red-600 font-medium" : ""}`}>
                          {formatFecha(a.fecha_vencimiento)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[a.estado]}`}>
                          {ESTADO_LABELS[a.estado]}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {a.estado === "completada" ? (
                          <span className="text-xs font-mono">
                            <span className="text-red-600">{a.nc_mayores}</span>
                            {" / "}
                            <span className="text-orange-500">{a.nc_menores}</span>
                            {" / "}
                            <span className="text-yellow-600">{a.observaciones_count}</span>
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          {canEdit && a.estado !== "completada" && (
                            <Button size="sm" variant="outline"
                              className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => { setCompletarAuditoria(a); setShowCompletar(true); }}>
                              <FileCheck className="h-3 w-3 mr-1" />Completar
                            </Button>
                          )}
                          {canEdit && a.estado === "programada" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Marcar en curso"
                              onClick={() => handleEnCurso(a.id)}>
                              <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                          )}
                          {a.archivo_url && (
                            <a href={a.archivo_url} target="_blank" rel="noopener noreferrer">
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver informe">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          {canEdit && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar"
                              onClick={() => { setEditAuditoria(a); setShowForm(true); }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button size="icon" variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive" title="Eliminar"
                              onClick={() => handleDelete(a.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AuditoriaFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={load}
        areas={areas}
        usuarios={usuarios}
        auditoria={editAuditoria}
      />
      <CompletarAuditoriaModal
        open={showCompletar}
        onOpenChange={setShowCompletar}
        onSuccess={load}
        auditoria={completarAuditoria}
      />
    </div>
  );
}
