import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { RenovarModal } from "@/components/items/renovar-modal";
import { SubirProcedimientoModal } from "@/components/items/subir-procedimiento-modal";
import { ComentariosSection } from "@/components/items/comentarios-section";
import { formatFecha, formatBytes } from "@/lib/utils/format";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import {
  FileText, Download, Clock, User, Tag, Calendar, Hash, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: item },
    { data: usuario },
  ] = await Promise.all([
    supabase
      .from("items")
      .select(`
        *,
        clausulas_iso(id, titulo),
        areas(id, nombre),
        usuarios!responsable_id(id, nombre, email)
      `)
      .eq("id", params.id)
      .single(),
    supabase.from("usuarios").select("*").eq("id", user.id).single(),
  ]);

  if (!item) notFound();

  // Archivos del item
  const { data: archivos } = await supabase
    .from("archivos")
    .select("*, subidor:usuarios!subido_por(nombre), aprobador:usuarios!aprobado_por(nombre)")
    .eq("item_id", params.id)
    .order("version", { ascending: false });

  const documentos = archivos?.filter((a) => (a.categoria ?? "documento") === "documento") ?? [];
  const procedimientos = archivos?.filter((a) => a.categoria === "procedimiento") ?? [];

  // Historial
  const { data: historial } = await supabase
    .from("historial")
    .select("*, usuarios(nombre)")
    .eq("item_id", params.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const canEdit = usuario?.rol === "admin" || (
    usuario?.rol === "editor" && (
      item.responsable_id === user.id ||
      item.area_id === usuario.area_id ||
      (usuario.tipos_habilitados as string[]).includes(item.tipo)
    )
  );
  const isAdmin = usuario?.rol === "admin";

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={item.titulo}
        actions={
          canEdit ? (
            <>
              <SubirProcedimientoModal item={item} />
              <RenovarModal item={item} />
              <Button variant="outline" size="sm" asChild>
                <Link href={`/items/${params.id}/editar`}>Editar</Link>
              </Button>
            </>
          ) : null
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/items" className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Documentos
          </Link>
          <span>/</span>
          <span className="font-mono text-xs">{item.codigo}</span>
        </div>

        {/* Header del item */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-sm font-bold text-primary">{item.codigo}</span>
              <span className="text-muted-foreground text-sm font-mono">({item.codigo_completo})</span>
              {item.codigo_formal && (
                <span className="text-xs text-muted-foreground">· <span className="font-medium">{item.codigo_formal}</span></span>
              )}
              <EstadoBadge estado={item.estado} />
              <Badge variant="outline" className="text-xs">v{item.version_actual}</Badge>
              {item.es_borrador && (
                <Badge variant="secondary">Borrador</Badge>
              )}
            </div>
            <h2 className="text-xl font-bold">{item.titulo}</h2>
            {item.descripcion && (
              <p className="text-muted-foreground mt-1">{item.descripcion}</p>
            )}
            {item.etiquetas?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                {item.etiquetas.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Botones de aprobación (solo admin) */}
          {isAdmin && item.estado === "pendiente_aprobacion" && (
            <div className="flex gap-2">
              <AprobacionButtons itemId={item.id} />
            </div>
          )}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetaCard icon={Hash} label="Tipo" value={TIPO_ITEM_LABELS[item.tipo as keyof typeof TIPO_ITEM_LABELS]} />
          <MetaCard icon={FileText} label="Cláusula ISO" value={`${(item as Record<string, unknown> & { clausulas_iso?: { id: string; titulo: string } }).clausulas_iso?.id} — ${(item as Record<string, unknown> & { clausulas_iso?: { id: string; titulo: string } }).clausulas_iso?.titulo?.slice(0, 30)}...`} />
          <MetaCard icon={User} label="Responsable" value={(item as Record<string, unknown> & { usuarios?: { nombre: string } }).usuarios?.nombre ?? "—"} />
          <MetaCard icon={FileText} label="Área" value={(item as Record<string, unknown> & { areas?: { nombre: string } }).areas?.nombre ?? "—"} />
          <MetaCard icon={Calendar} label="Emisión" value={formatFecha(item.fecha_emision)} />
          <MetaCard icon={Clock} label="Vencimiento" value={formatFecha(item.fecha_vencimiento)} highlighted={item.estado === "vencido" || item.estado === "por_vencer"} />
          <MetaCard icon={Clock} label="Frecuencia" value={item.frecuencia_dias ? `${item.frecuencia_dias} días` : "Sin frecuencia"} />
          <MetaCard icon={Calendar} label="Última actualización" value={formatFecha(item.updated_at)} />
        </div>

        <Separator />

        {/* Tabs: Archivos / Historial / Comentarios */}
        <Tabs defaultValue="archivos">
          <TabsList>
            <TabsTrigger value="archivos">
              Documento ({documentos.length})
            </TabsTrigger>
            <TabsTrigger value="procedimiento">
              Procedimiento ({procedimientos.length})
            </TabsTrigger>
            <TabsTrigger value="historial">
              Historial ({historial?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="comentarios">Comentarios</TabsTrigger>
          </TabsList>

          {/* Documento principal */}
          <TabsContent value="archivos" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {!documentos.length ? (
                  <p className="px-6 py-10 text-sm text-muted-foreground text-center">
                    No hay documento cargado. Usá el botón &quot;Renovar&quot; para subir el primer archivo.
                  </p>
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
                              Aprobado por {archivo.aprobador?.nombre} el {formatFecha(archivo.aprobado_at)}
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

          {/* Procedimiento */}
          <TabsContent value="procedimiento" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {!procedimientos.length ? (
                  <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                    No hay procedimiento cargado.{" "}
                    {canEdit && <span>Usá el botón &quot;Subir procedimiento&quot; arriba.</span>}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {(procedimientos as Array<Record<string, unknown> & { id: string; nombre_archivo: string; tamaño_bytes: number | null; subido_at: string; comentario: string | null; version: number; archivo_url: string; subidor?: { nombre: string } | null }>).map((archivo) => (
                      <li key={archivo.id} className="flex items-center gap-4 px-6 py-4">
                        <FileText className="h-8 w-8 text-purple-400 shrink-0" />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate">{archivo.nombre_archivo}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(archivo.tamaño_bytes)} · {formatFecha(archivo.subido_at)} · por {archivo.subidor?.nombre ?? "—"}
                          </p>
                          {archivo.comentario && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">{archivo.comentario}</p>
                          )}
                        </div>
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

          {/* Historial */}
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

          {/* Comentarios */}
          <TabsContent value="comentarios" className="mt-4">
            <ComentariosSection itemId={params.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MetaCard({ icon: Icon, label, value, highlighted }: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlighted ? "border-orange-200 bg-orange-50" : "bg-white"}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${highlighted ? "text-orange-500" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-sm font-medium truncate ${highlighted ? "text-orange-700" : ""}`}>{value}</p>
    </div>
  );
}

function AprobacionButtons({ itemId }: { itemId: string }) {
  return (
    <div className="flex gap-2 items-center p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
      <span className="text-sm text-yellow-700 font-medium">Pendiente aprobación</span>
      <form action={`/api/items/${itemId}/aprobar`} method="POST">
        <input type="hidden" name="aprobar" value="true" />
        <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">Aprobar</Button>
      </form>
      <form action={`/api/items/${itemId}/aprobar`} method="POST">
        <input type="hidden" name="aprobar" value="false" />
        <Button type="submit" size="sm" variant="destructive">Rechazar</Button>
      </form>
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
