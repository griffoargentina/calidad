import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { formatFecha } from "@/lib/utils/format";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import {
  FileText, AlertTriangle, CheckCircle2, XCircle,
  ArrowRight, TrendingUp, BookOpen,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { count: totalItems },
    { count: vencidosReales },
    { count: vigentes },
    { data: itemsUrgentes },
    { data: actividadReciente },
    { data: todosItems },
    { data: archivosDoc },
    { data: archivosProc },
  ] = await Promise.all([
    supabase.from("items").select("*", { count: "exact", head: true }).eq("es_borrador", false),
    supabase.from("items").select("*", { count: "exact", head: true })
      .eq("estado", "vencido").eq("es_borrador", false),
    supabase.from("items").select("*", { count: "exact", head: true })
      .eq("estado", "vigente").eq("es_borrador", false),
    supabase.from("items")
      .select("id, codigo, titulo, tipo, estado, fecha_vencimiento, usuarios!responsable_id(nombre)")
      .eq("estado", "vencido")
      .eq("es_borrador", false)
      .order("fecha_vencimiento", { ascending: true })
      .limit(5),
    supabase.from("historial")
      .select("id, accion, created_at, detalle, usuarios(nombre), items(codigo, titulo)")
      .order("created_at", { ascending: false })
      .limit(8),
    // Todos (publicados + borradores) → para sin archivo y sin procedimiento
    supabase.from("items").select("id, codigo, titulo, tipo, es_borrador").neq("estado", "obsoleto"),
    supabase.from("archivos").select("item_id").eq("categoria", "documento"),
    supabase.from("archivos").select("item_id").eq("categoria", "procedimiento"),
  ]);

  const conDocSet  = new Set(archivosDoc?.map((a) => a.item_id) ?? []);
  const conProcSet = new Set(archivosProc?.map((a) => a.item_id) ?? []);

  // Sin archivo = TODOS los items sin documento adjunto → se suman a "vencidos"
  const itemsSinArchivo = (todosItems ?? []).filter((i) => !conDocSet.has(i.id));
  const sinArchivo = itemsSinArchivo.length;

  // Sin procedimiento = TODOS los items (inc. borradores) sin procedimiento adjunto
  const itemsSinProcedimiento = (todosItems ?? []).filter((i) => !conProcSet.has(i.id));
  const sinProcedimiento = itemsSinProcedimiento.length;

  const total = totalItems ?? 0;
  const totalConBorradores = todosItems?.length ?? 0;
  // Vencidos efectivos = vencidos reales + TODOS los items sin archivo (incluyendo borradores)
  const vencidosTotal = (vencidosReales ?? 0) + sinArchivo;
  const cumplimiento = totalConBorradores > 0
    ? Math.max(0, Math.round(((totalConBorradores - vencidosTotal) / totalConBorradores) * 100))
    : 0;

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        {/* Tarjetas de métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Total documentos"
            value={total}
            icon={FileText}
            iconColor="text-blue-500"
            bgColor="bg-blue-50"
            href="/items"
          />
          <MetricCard
            title="Vencidos"
            value={vencidosTotal}
            icon={AlertTriangle}
            iconColor="text-red-500"
            bgColor="bg-red-50"
            subtitle={sinArchivo > 0 ? `${vencidosReales ?? 0} reales + ${sinArchivo} sin archivo` : `${vencidosReales ?? 0} vencidos`}
            alert={vencidosTotal > 0}
            href="#vencidos-detalle"
          />
          <MetricCard
            title="% cumplimiento"
            value={`${cumplimiento}%`}
            icon={cumplimiento >= 80 ? CheckCircle2 : cumplimiento >= 50 ? AlertTriangle : XCircle}
            iconColor={cumplimiento >= 80 ? "text-green-500" : cumplimiento >= 50 ? "text-yellow-500" : "text-red-500"}
            bgColor={cumplimiento >= 80 ? "bg-green-50" : cumplimiento >= 50 ? "bg-yellow-50" : "bg-red-50"}
            subtitle={totalConBorradores === 0 ? "Sin documentos cargados" : `${vigentes ?? 0} vigentes`}
            alert={cumplimiento < 50}
          />
          <MetricCard
            title="Sin procedimiento"
            value={sinProcedimiento}
            icon={BookOpen}
            iconColor={sinProcedimiento > 0 ? "text-orange-500" : "text-green-500"}
            bgColor={sinProcedimiento > 0 ? "bg-orange-50" : "bg-green-50"}
            subtitle={`De ${todosItems?.length ?? 0} items en total`}
            alert={sinProcedimiento > 0}
            href="#sin-procedimiento"
          />
        </div>

        {/* Listas de atención */}
        {(vencidosTotal > 0 || sinProcedimiento > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Vencidos + sin archivo */}
            {vencidosTotal > 0 && (
              <Card id="vencidos-detalle" className="border-red-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Vencidos / sin archivo ({vencidosTotal})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-72 overflow-y-auto">
                  <ul className="divide-y">
                    {(itemsUrgentes as unknown as Array<{ id: string; codigo: string; titulo: string; tipo: string; estado: string; fecha_vencimiento: string | null }>)?.map((item) => (
                      <li key={item.id}>
                        <Link href={`/items/${item.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50/50 transition-colors">
                          <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{item.codigo}</span>
                          <span className="text-xs font-medium flex-1 truncate">{item.titulo}</span>
                          <EstadoBadge estado={item.estado as import("@/types/database").EstadoItem} />
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </Link>
                      </li>
                    ))}
                    {itemsSinArchivo.map((item) => (
                      <li key={item.id}>
                        <Link href={`/items/${item.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50/50 transition-colors">
                          <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{item.codigo}</span>
                          <span className="text-xs font-medium flex-1 truncate">{item.titulo}</span>
                          <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full shrink-0">Sin archivo</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Sin procedimiento — todos los items */}
            {sinProcedimiento > 0 && (
              <Card id="sin-procedimiento" className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-700">
                    <BookOpen className="h-4 w-4 text-orange-500" />
                    Sin procedimiento ({sinProcedimiento})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-72 overflow-y-auto">
                  <ul className="divide-y">
                    {itemsSinProcedimiento.map((item) => (
                      <li key={item.id}>
                        <Link href={`/items/${item.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50/50 transition-colors">
                          <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{item.codigo}</span>
                          <span className="text-xs font-medium flex-1 truncate">{item.titulo}</span>
                          {item.es_borrador && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">Borrador</span>
                          )}
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Items más urgentes */}
          <div className="xl:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Items vencidos más urgentes
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/items?estado=vencido">
                    Ver todos <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {!itemsUrgentes?.length ? (
                  <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    No hay items vencidos. ¡Excelente!
                  </div>
                ) : (
                  <ul className="divide-y">
                    {(itemsUrgentes as unknown as Array<{ id: string; codigo: string; titulo: string; tipo: string; estado: string; fecha_vencimiento: string | null; usuarios?: { nombre: string } | { nombre: string }[] | null }>).map((item) => (
                      <li key={item.id}>
                        <Link href={`/items/${item.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors">
                          <div className="flex-1 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono text-xs text-muted-foreground">{item.codigo}</span>
                              <EstadoBadge estado={item.estado as import("@/types/database").EstadoItem} />
                            </div>
                            <p className="text-sm font-medium truncate">{item.titulo}</p>
                            <p className="text-xs text-muted-foreground">
                              {TIPO_ITEM_LABELS[item.tipo as keyof typeof TIPO_ITEM_LABELS]} ·{" "}
                              {(Array.isArray(item.usuarios) ? item.usuarios[0]?.nombre : item.usuarios?.nombre) ?? "Sin responsable"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-red-500 font-medium">Venció {formatFecha(item.fecha_vencimiento)}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actividad reciente */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Actividad reciente
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!actividadReciente?.length ? (
                  <p className="px-6 py-8 text-sm text-muted-foreground text-center">Sin actividad reciente</p>
                ) : (
                  <ul className="divide-y">
                    {(actividadReciente as unknown as Array<{ id: string; accion: string; created_at: string; usuarios?: { nombre: string } | { nombre: string }[] | null; items?: { id: string; codigo: string; titulo: string } | { id: string; codigo: string; titulo: string }[] | null }>).map((h) => (
                      <li key={h.id} className="px-6 py-3">
                        <p className="text-xs font-medium">
                          <span className="text-muted-foreground">{(Array.isArray(h.usuarios) ? h.usuarios[0]?.nombre : h.usuarios?.nombre) ?? "Sistema"}</span>{" "}
                          {accionLabel(h.accion)}{" "}
                          {h.items && (() => { const itm = Array.isArray(h.items) ? h.items[0] : h.items; return itm ? <Link href={`/items/${itm.id}`} className="text-primary hover:underline">{itm.codigo}</Link> : null; })()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatFecha(h.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Atajos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/items/nuevo">Nuevo documento</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/items?estado=por_vencer">Ver próximos a vencer</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/clausulas">Mapa de cláusulas ISO</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vencimientos">Calendario de vencimientos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title, value, icon: Icon, iconColor, bgColor, href, subtitle, alert,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  href?: string;
  subtitle?: string;
  alert?: boolean;
}) {
  const content = (
    <Card className={alert ? "border-red-200 bg-red-50/30" : ""}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${bgColor} shrink-0`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href} className="block hover:opacity-90 transition-opacity">{content}</Link>;
  return content;
}

function accionLabel(accion: string): string {
  const labels: Record<string, string> = {
    alta: "creó",
    edicion: "editó",
    descarga: "descargó",
    renovacion: "renovó",
    aprobacion: "aprobó",
    rechazo: "rechazó",
    importacion_masiva: "importó",
  };
  return labels[accion] ?? accion;
}
