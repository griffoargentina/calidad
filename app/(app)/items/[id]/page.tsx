import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { RenovarModal } from "@/components/items/renovar-modal";
import { SubirProcedimientoModal } from "@/components/items/subir-procedimiento-modal";
import { ComentariosSection } from "@/components/items/comentarios-section";
import { formatFecha, formatBytes } from "@/lib/utils/format";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import {
  FileText, Download, User, Tag, Calendar, Hash, ArrowLeft,
  BookOpen, RefreshCw, Clock, CheckCircle2, AlertTriangle, XCircle,
  Building2, Layers,
} from "lucide-react";
import Link from "next/link";

const FRECUENCIA_LABEL: Record<number, string> = {
  30: "Mensual",
  60: "Bimestral",
  90: "Trimestral",
  180: "Semestral",
  365: "Anual",
  730: "Bienal",
};

function frecuenciaLabel(dias: number | null) {
  if (!dias) return "Sin frecuencia definida";
  return FRECUENCIA_LABEL[dias] ?? `Cada ${dias} días`;
}

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: item }, { data: usuario }] = await Promise.all([
    supabase
      .from("items")
      .select(`*, clausulas_iso(id, titulo), areas(id, nombre), usuarios!responsable_id(id, nombre, email)`)
      .eq("id", params.id)
      .single(),
    supabase.from("usuarios").select("*").eq("id", user.id).single(),
  ]);

  if (!item) notFound();

  const { data: archivos } = await supabase
    .from("archivos")
    .select("*, subidor:usuarios!subido_por(nombre), aprobador:usuarios!aprobado_por(nombre)")
    .eq("item_id", params.id)
    .order("version", { ascending: false });

  const { data: historial } = await supabase
    .from("historial")
    .select("*, usuarios(nombre)")
    .eq("item_id", params.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const documentos = archivos?.filter((a) => (a.categoria ?? "documento") === "documento") ?? [];
  const procedimientos = archivos?.filter((a) => a.categoria === "procedimiento") ?? [];

  const canEdit = usuario?.rol === "admin" || (
    usuario?.rol === "editor" && (
      item.responsable_id === user.id ||
      item.area_id === usuario.area_id ||
      (usuario.tipos_habilitados as string[]).includes(item.tipo)
    )
  );
  const isAdmin = usuario?.rol === "admin";

  const clausula = item.clausulas_iso as { id: string; titulo: string } | null;
  const area = item.areas as { nombre: string } | null;
  const responsable = item.usuarios as { nombre: string; email: string } | null;

  // Semáforo de estado
  const semaforoColor =
    item.estado === "vigente"             ? "text-green-600 bg-green-50 border-green-200" :
    item.estado === "por_vencer"          ? "text-yellow-600 bg-yellow-50 border-yellow-200" :
    item.estado === "vencido"             ? "text-red-600 bg-red-50 border-red-200" :
    item.estado === "pendiente_aprobacion"? "text-blue-600 bg-blue-50 border-blue-200" :
    "text-slate-500 bg-slate-50 border-slate-200";

  const SemaforoIcon =
    item.estado === "vigente"              ? CheckCircle2 :
    item.estado === "por_vencer"           ? AlertTriangle :
    item.estado === "vencido"              ? XCircle :
    Clock;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={item.titulo}
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <SubirProcedimientoModal item={item} />
              <RenovarModal item={item} />
              <Button variant="outline" size="sm" asChild>
                <Link href={`/items/${params.id}/editar`}>Editar</Link>
              </Button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-5">

        {/* Breadcrumb + códigos */}
        <div className="flex items-center justify-between">
          <Link href="/items" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Documentos
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-primary">{item.codigo}</span>
            <span className="text-xs text-muted-foreground font-mono">({item.codigo_completo})</span>
            {item.codigo_formal && (
              <Badge variant="outline" className="text-xs font-normal">{item.codigo_formal}</Badge>
            )}
            <Badge variant="outline" className="text-xs">v{item.version_actual}</Badge>
            {item.es_borrador && <Badge variant="secondary">Borrador</Badge>}
          </div>
        </div>

        {item.descripcion && (
          <p className="text-sm text-muted-foreground border-l-4 border-primary/20 pl-3">
            {item.descripcion}
          </p>
        )}

        {item.etiquetas?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {item.etiquetas.map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Aprobación pendiente */}
        {isAdmin && item.estado === "pendiente_aprobacion" && (
          <div className="flex gap-2 items-center p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
            <span className="text-sm text-yellow-700 font-medium flex-1">Pendiente de aprobación</span>
            <form action={`/api/items/${params.id}/aprobar`} method="POST">
              <input type="hidden" name="aprobar" value="true" />
              <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">Aprobar</Button>
            </form>
            <form action={`/api/items/${params.id}/aprobar`} method="POST">
              <input type="hidden" name="aprobar" value="false" />
              <Button type="submit" size="sm" variant="destructive">Rechazar</Button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* ── SECCIÓN 1: PROCEDIMIENTO ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-purple-500" />
                Procedimiento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {procedimientos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-3 border-2 border-dashed rounded-lg">
                  <BookOpen className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Sin procedimiento cargado</p>
                  {canEdit && <SubirProcedimientoModal item={item} />}
                </div>
              ) : (
                <ul className="space-y-2">
                  {(procedimientos as Array<Record<string, unknown> & { id: string; nombre_archivo: string; tamaño_bytes: number | null; subido_at: string; comentario: string | null; archivo_url: string; subidor?: { nombre: string } | null }>).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-100">
                      <FileText className="h-5 w-5 text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.nombre_archivo}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(p.tamaño_bytes)} · {formatFecha(p.subido_at)}</p>
                      </div>
                      <Button variant="ghost" size="icon" asChild>
                        <a href={p.archivo_url} target="_blank" rel="noopener noreferrer" download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── SECCIÓN 2: INFORMACIÓN GENERAL ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" />
                Información general
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={Hash} label="Tipo" value={TIPO_ITEM_LABELS[item.tipo as keyof typeof TIPO_ITEM_LABELS]} />
              <InfoRow icon={FileText} label="Cláusula ISO" value={clausula ? `${clausula.id} — ${clausula.titulo}` : "—"} />
              <InfoRow icon={Building2} label="Área" value={area?.nombre ?? "—"} />
              <Separator />
              <InfoRow
                icon={RefreshCw}
                label="Frecuencia de revisión"
                value={frecuenciaLabel(item.frecuencia_dias)}
                highlight={!!item.frecuencia_dias}
              />
            </CardContent>
          </Card>

          {/* ── SECCIÓN 3: ESTADO ── */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <SemaforoIcon className="h-4 w-4" />
                Estado del documento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`rounded-lg border px-4 py-3 ${semaforoColor}`}>
                  <p className="text-xs font-medium opacity-70 mb-1">Estado</p>
                  <EstadoBadge estado={item.estado} />
                </div>
                <div className="rounded-lg border px-4 py-3 bg-slate-50">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <User className="h-3 w-3" /> Responsable
                  </p>
                  <p className="text-sm font-medium">{responsable?.nombre ?? "—"}</p>
                </div>
                <div className={`rounded-lg border px-4 py-3 ${item.estado === "vencido" ? "bg-red-50 border-red-200" : "bg-slate-50"}`}>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Vencimiento
                  </p>
                  <p className={`text-sm font-medium ${item.estado === "vencido" ? "text-red-600" : ""}`}>
                    {formatFecha(item.fecha_vencimiento) ?? "Sin fecha"}
                  </p>
                </div>
                <div className="rounded-lg border px-4 py-3 bg-slate-50">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Última modificación
                  </p>
                  <p className="text-sm font-medium">{formatFecha(item.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Documento principal + Historial + Comentarios */}
        <Tabs defaultValue="documento">
          <TabsList>
            <TabsTrigger value="documento">
              Documento ({documentos.length})
            </TabsTrigger>
            <TabsTrigger value="historial">
              Historial ({historial?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="comentarios">Comentarios</TabsTrigger>
          </TabsList>

          <TabsContent value="documento" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {!documentos.length ? (
                  <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Sin documento cargado.{" "}
                    {canEdit && <span>Usá el botón <strong>Renovar</strong> para subir el primer archivo.</span>}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {(documentos as Array<Record<string, unknown> & { id: string; nombre_archivo: string; tamaño_bytes: number | null; subido_at: string; comentario: string | null; aprobado_at: string | null; version: number; archivo_url: string; subidor?: { nombre: string } | null; aprobador?: { nombre: string } | null }>).map((archivo) => (
                      <li key={archivo.id} className="flex items-center gap-4 px-6 py-4">
                        <FileText className="h-8 w-8 text-blue-400 shrink-0" />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate">{archivo.nombre_archivo}</p>
                          <p className="text-xs text-muted-foreground">
                            v{archivo.version} · {formatBytes(archivo.tamaño_bytes)} · {formatFecha(archivo.subido_at)} · por {archivo.subidor?.nombre ?? "—"}
                          </p>
                          {archivo.comentario && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">{archivo.comentario}</p>
                          )}
                          {archivo.aprobado_at && (
                            <p className="text-xs text-green-600 mt-0.5">
                              Aprobado por {archivo.aprobador?.nombre} · {formatFecha(archivo.aprobado_at)}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0">v{archivo.version}</Badge>
                        <Button variant="ghost" size="icon" asChild>
                          <a href={archivo.archivo_url} target="_blank" rel="noopener noreferrer" download>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historial" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {!historial?.length ? (
                  <p className="px-6 py-10 text-sm text-muted-foreground text-center">Sin actividad registrada</p>
                ) : (
                  <ul className="divide-y">
                    {(historial as Array<{ id: string; accion: string; created_at: string; detalle: Record<string, unknown>; usuarios?: { nombre: string } | null }>).map((h) => (
                      <li key={h.id} className="px-6 py-3 flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm">
                            <span className="font-medium">{h.usuarios?.nombre ?? "Sistema"}</span>{" "}
                            {accionHistorialLabel(h.accion)}
                          </p>
                          {h.accion === "renovacion" && h.detalle && (
                            <p className="text-xs text-muted-foreground">
                              v{String(h.detalle.version_anterior)} → v{String(h.detalle.version_nueva)}
                              {h.detalle.archivo ? ` · ${String(h.detalle.archivo)}` : ""}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">{formatFecha(h.created_at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comentarios" className="mt-4">
            <ComentariosSection itemId={params.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, highlight }: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${highlight ? "text-primary" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function accionHistorialLabel(accion: string): string {
  const labels: Record<string, string> = {
    alta: "creó el documento",
    edicion: "editó el documento",
    descarga: "descargó un archivo",
    renovacion: "renovó el documento",
    aprobacion: "aprobó el documento",
    rechazo: "rechazó la revisión",
    importacion_masiva: "importó el documento",
  };
  return labels[accion] ?? accion;
}
