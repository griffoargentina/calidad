import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RenovarModal } from "@/components/items/renovar-modal";
import { SubirProcedimientoModal } from "@/components/items/subir-procedimiento-modal";
import { QuickEditPanel } from "@/components/items/quick-edit-panel";
import { ProcNaToggle } from "@/components/items/proc-na-toggle";
import { DocNaToggle } from "@/components/items/doc-na-toggle";
import { ComentariosSection } from "@/components/items/comentarios-section";
import { formatFecha, formatBytes } from "@/lib/utils/format";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import {
  FileText, Download, Tag, Calendar, Hash, ArrowLeft,
  BookOpen, CheckCircle2, XCircle, Building2, Layers, User, RefreshCw,
} from "lucide-react";
import Link from "next/link";

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: item }, { data: usuario }, { data: todosUsuarios }, { data: tiposDocumento }] = await Promise.all([
    supabase
      .from("items")
      .select(`*, clausulas_iso(id, titulo), areas(id, nombre), usuarios!responsable_id(id, nombre, email)`)
      .eq("id", params.id)
      .single(),
    supabase.from("usuarios").select("*").eq("id", user.id).single(),
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("proc_tipos_documento").select("id, prefijo, nombre").eq("activo", true).order("orden"),
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

  const documentos    = archivos?.filter((a) => (a.categoria ?? "documento") === "documento") ?? [];
  const procedimientos = archivos?.filter((a) => a.categoria === "procedimiento") ?? [];

  const canEdit = usuario?.rol === "admin" || (
    usuario?.rol === "editor" && (
      item.responsable_id === user.id ||
      item.area_id === usuario.area_id ||
      (usuario.tipos_habilitados as string[]).includes(item.tipo)
    )
  );

  const clausula   = item.clausulas_iso as { id: string; titulo: string } | null;
  const area       = item.areas as { nombre: string } | null;
  const responsable = item.usuarios as { id: string; nombre: string; email: string } | null;

  // Semáforos
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const docNa     = meta.documento_na === true;
  const tieneDoc  = documentos.length > 0 || docNa;
  const tieneProc = procedimientos.length > 0 || meta.procedimiento_na === true;
  const tieneResponsable = !!responsable;
  const tieneFrecuencia  = !!item.frecuencia_dias;
  // Calcular vencimiento directo desde la fecha, no desde el campo estado (puede estar desactualizado)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fechaVenc = item.fecha_vencimiento ? new Date(item.fecha_vencimiento) : null;
  const vencimientoOk = fechaVenc ? fechaVenc >= hoy : false;
  const vencimientoPorVencer = fechaVenc
    ? fechaVenc >= hoy && fechaVenc <= new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)
    : false;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={item.titulo}
        actions={
          canEdit ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/items/${params.id}/editar`}>Editar</Link>
            </Button>
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
            <Badge variant="outline" className="text-xs">v{item.version_actual}</Badge>
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


        {/* ── SEMÁFOROS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <SemaforoCard
            label="Responsable"
            ok={tieneResponsable}
            okText={responsable?.nombre ?? ""}
            failText="Sin asignar"
            icon={User}
          />
          <SemaforoCard
            label="Periodicidad"
            ok={tieneFrecuencia}
            okText={item.frecuencia_dias ? `Cada ${item.frecuencia_dias} días` : ""}
            failText="Sin definir"
            icon={RefreshCw}
          />
          <SemaforoCard
            label="Procedimiento"
            ok={tieneProc}
            okText="Cargado"
            failText="Falta cargar"
            icon={BookOpen}
          />
          <SemaforoCard
            label="Documento"
            ok={tieneDoc}
            okText="Cargado"
            failText="Falta cargar"
            icon={FileText}
          />
          <SemaforoCard
            label="Vencimiento"
            ok={vencimientoOk}
            warn={vencimientoPorVencer}
            okText={formatFecha(item.fecha_vencimiento) ?? ""}
            failText={item.fecha_vencimiento ? `Venció ${formatFecha(item.fecha_vencimiento)}` : "Sin fecha"}
            icon={Calendar}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* ── PROCEDIMIENTO ── */}
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
                  {canEdit && (
                    <div className="w-full space-y-2 px-2">
                      <SubirProcedimientoModal item={item} tipos={tiposDocumento ?? []} />
                      <ProcNaToggle itemId={params.id} value={meta.procedimiento_na === true} />
                    </div>
                  )}
                </div>
              ) : (
                <ul className="space-y-2">
                  {(procedimientos as Array<Record<string, unknown> & { id: string; nombre_archivo: string; tamaño_bytes: number | null; subido_at: string; archivo_url: string }>).map((p) => (
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
                  {canEdit && (
                    <li className="pt-1">
                      <SubirProcedimientoModal item={item} tipos={tiposDocumento ?? []} />
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── INFORMACIÓN + EDICIÓN RÁPIDA ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" />
                Información general
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="text-sm font-medium">{TIPO_ITEM_LABELS[item.tipo as keyof typeof TIPO_ITEM_LABELS]}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Cláusula ISO</p>
                  <p className="text-sm font-medium">{clausula ? `${clausula.id} — ${clausula.titulo}` : "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Área</p>
                  <p className="text-sm font-medium">{area?.nombre ?? "—"}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <QuickEditPanel
                    itemId={params.id}
                    descripcion={item.descripcion ?? null}
                    responsableId={responsable?.id ?? null}
                    responsableNombre={responsable?.nombre ?? null}
                    frecuenciaDias={item.frecuencia_dias ?? null}
                    fechaVencimiento={item.fecha_vencimiento ?? null}
                    usuarios={todosUsuarios ?? []}
                    canEdit={canEdit}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Documento + Historial + Comentarios */}
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

          <TabsContent value="documento" className="mt-4 space-y-3">
            {canEdit && (
              <div className="flex justify-end">
                <RenovarModal item={item} tipos={tiposDocumento ?? []} />
              </div>
            )}
            <Card>
              <CardContent className="p-0">
                {!documentos.length ? (
                  <div className="px-6 py-10 text-center text-sm text-muted-foreground space-y-3">
                    <div>
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      {!docNa && (
                        <>Sin documento cargado.{" "}
                        {canEdit && <span>Usá el botón <strong>Renovar</strong> para subir el primer archivo.</span>}</>
                      )}
                    </div>
                    {canEdit && (
                      <div className="max-w-xs mx-auto">
                        <DocNaToggle itemId={params.id} value={docNa} />
                      </div>
                    )}
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
                          <a href={`/api/download?url=${encodeURIComponent(archivo.archivo_url)}`} download={archivo.nombre_archivo}>
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

function SemaforoCard({ label, ok, warn, okText, failText, icon: Icon }: {
  label: string;
  ok: boolean;
  warn?: boolean;
  okText: string;
  failText: string;
  icon: React.ElementType;
}) {
  const color = !ok ? "red" : warn ? "yellow" : "green";
  const bg   = color === "green" ? "bg-green-50 border-green-200" : color === "yellow" ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";
  const ico  = color === "green" ? "text-green-500" : color === "yellow" ? "text-yellow-500" : "text-red-500";
  const txt  = color === "green" ? "text-green-700" : color === "yellow" ? "text-yellow-700" : "text-red-700";
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${bg}`}>
      <Icon className={`h-5 w-5 shrink-0 ${ico}`} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          {ok && !warn && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
          {ok && warn  && <CheckCircle2 className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
          {!ok         && <XCircle      className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          <p className={`text-sm font-medium truncate ${txt}`}>
            {ok ? okText : failText}
          </p>
        </div>
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
