import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { formatFecha } from "@/lib/utils/format";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import {
  FileText, AlertTriangle, Clock, CheckCircle2, XCircle, ArrowRight, TrendingUp, BookOpen
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Métricas principales
  const [
    { count: totalItems },
    { count: vencidos },
    { count: porVencer },
    { count: vigentes },
    { data: itemsUrgentes },
    { data: actividadReciente },
    { data: itemsIds },
    { data: itemsConProcedimiento },
  ] = await Promise.all([
    supabase.from("items").select("*", { count: "exact", head: true }).eq("es_borrador", false),
    supabase.from("items").select("*", { count: "exact", head: true })
      .eq("estado", "vencido").eq("es_borrador", false),
    supabase.from("items").select("*", { count: "exact", head: true })
      .eq("estado", "por_vencer").eq("es_borrador", false),
    supabase.from("items").select("*", { count: "exact", head: true })
      .eq("estado", "vigente").eq("es_borrador", false),
    supabase.from("items")
      .select("id, codigo, titulo, tipo, estado, fecha_vencimiento, responsable_id, usuarios(nombre)")
      .eq("estado", "vencido")
      .eq("es_borrador", false)
      .order("fecha_vencimiento", { ascending: true })
      .limit(5),
    supabase.from("historial")
      .select("id, accion, created_at, detalle, usuarios(nombre), items(codigo, titulo)")
      .order("created_at", { ascending: false })
      .limit(8),
    // IDs de todos los items publicados
    supabase.from("items").select("id").eq("es_borrador", false),
    // Items que YA tienen procedimiento
    supabase.from("archivos").select("item_id").eq("categoria", "procedimiento"),
  ]);

  const totalPublicados = itemsIds?.length ?? 0;
  const conProcedimiento = new Set(itemsConProcedimiento?.map((a) => a.item_id) ?? []).size;
  const sinProcedimiento = totalPublicados - conProcedimiento;

  const total = totalItems ?? 0;
  const cumplimiento = total > 0
    ? Math.round(((total - (vencidos ?? 0)) / total) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        {/* Tarjetas de métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
            value={vencidos ?? 0}
            icon={AlertTriangle}
            iconColor="text-red-500"
            bgColor="bg-red-50"
            href="/items?estado=vencido"
            alert={!!vencidos && vencidos > 0}
          />
          <MetricCard
            title="Por vencer ≤30d"
            value={porVencer ?? 0}
            icon={Clock}
            iconColor="text-yellow-500"
            bgColor="bg-yellow-50"
            href="/items?estado=por_vencer"
          />
          <MetricCard
            title="% cumplimiento"
            value={`${cumplimiento}%`}
            icon={cumplimiento >= 80 ? CheckCircle2 : cumplimiento >= 50 ? AlertTriangle : XCircle}
            iconColor={cumplimiento >= 80 ? "text-green-500" : cumplimiento >= 50 ? "text-yellow-500" : "text-red-500"}
            bgColor={cumplimiento >= 80 ? "bg-green-50" : cumplimiento >= 50 ? "bg-yellow-50" : "bg-red-50"}
            subtitle={total === 0 ? "Sin documentos cargados" : `${vigentes ?? 0} vigentes`}
            alert={cumplimiento < 50}
          />
          <MetricCard
            title="Sin procedimiento"
            value={sinProcedimiento}
            icon={BookOpen}
            iconColor={sinProcedimiento > 0 ? "text-purple-500" : "text-green-500"}
            bgColor={sinProcedimiento > 0 ? "bg-purple-50" : "bg-green-50"}
            subtitle={`${conProcedimiento} de ${totalPublicados} tienen procedimiento`}
            alert={false}
          />
        </div>

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
                        <Link
                          href={`/items/${item.id}`}
                          className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors"
                        >
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
                            <p className="text-xs text-red-500 font-medium">
                              Venció {formatFecha(item.fecha_vencimiento)}
                            </p>
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
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatFecha(h.created_at)}
                        </p>
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
              <Link href="/items/importar">Importar desde Excel</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/items?estado=por_vencer">Ver próximos a vencer</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/clausulas">Mapa de cláusulas ISO</Link>
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
