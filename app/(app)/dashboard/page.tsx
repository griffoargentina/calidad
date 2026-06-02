import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { formatFecha } from "@/lib/utils/format";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import {
  FileText, AlertTriangle, CheckCircle2, XCircle,
  ArrowRight, TrendingUp, BookOpen, Wrench, BarChart2, ClipboardList,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [
    { count: totalItems },
    { count: vencidosReales },
    { count: vigentes },
    { data: itemsUrgentes },
    { data: actividadReciente },
    { data: todosItems },
    { data: archivosDoc },
    { data: archivosProc },
    { data: calibraciones },
    { data: equiposCalib },
    { data: indicadores },
    { data: indRegistros },
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
    supabase.from("items").select("id, codigo, titulo, tipo, es_borrador, metadata").neq("estado", "obsoleto"),
    supabase.from("archivos").select("item_id").eq("categoria", "documento"),
    supabase.from("archivos").select("item_id").eq("categoria", "procedimiento"),
    supabase.from("calibraciones")
      .select("equipo_id, fecha_vencimiento")
      .order("fecha_calibracion", { ascending: false }),
    supabase.from("equipos_calibracion").select("id").eq("activo", true),
    supabase.from("indicadores").select("id, frecuencia, activo").eq("activo", true),
    supabase.from("indicador_registros").select("indicador_id, anio, mes"),
  ]);

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const conDocSet  = new Set(archivosDoc?.map((a) => a.item_id) ?? []);
  const conProcSet = new Set(archivosProc?.map((a) => a.item_id) ?? []);

  const itemsSinArchivo = (todosItems ?? []).filter((i) => {
    if (conDocSet.has(i.id)) return false;
    const meta = (i.metadata ?? {}) as Record<string, unknown>;
    if (meta.documento_na === true) return false;
    return true;
  });
  const sinArchivo = itemsSinArchivo.length;

  const itemsSinProcedimiento = (todosItems ?? []).filter((i) => {
    if (conProcSet.has(i.id)) return false;
    const meta = (i.metadata ?? {}) as Record<string, unknown>;
    if (meta.procedimiento_na === true) return false;
    return true;
  });
  const sinProcedimiento = itemsSinProcedimiento.length;

  const total = totalItems ?? 0;
  const totalConBorradores = todosItems?.length ?? 0;
  const vencidosTotal = (vencidosReales ?? 0) + sinArchivo;
  const cumplimiento = totalConBorradores > 0
    ? Math.max(0, Math.round(((totalConBorradores - vencidosTotal) / totalConBorradores) * 100))
    : 0;

  // Calibraciones: solo equipos activos
  const activeEquipoIds = new Set((equiposCalib ?? []).map((e) => e.id));
  const calibMap = new Map<string, string | null>();
  for (const c of calibraciones ?? []) {
    if (!activeEquipoIds.has(c.equipo_id)) continue;
    if (!calibMap.has(c.equipo_id)) calibMap.set(c.equipo_id, c.fecha_vencimiento);
  }
  let calibVencidos = 0;
  let calibPrimerVencido: Date | null = null;
  for (const eq of equiposCalib ?? []) {
    const fvStr = calibMap.has(eq.id) ? calibMap.get(eq.id) : undefined;
    const fv = fvStr ? new Date(fvStr + "T00:00:00") : null;
    if (fvStr === undefined || !fv || fv < hoy) {
      calibVencidos++;
      if (fv && (!calibPrimerVencido || fv < calibPrimerVencido)) calibPrimerVencido = fv;
    }
  }

  // Indicadores: sin dato = vencido
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  const registroSet = new Set(
    (indRegistros ?? []).map((r) => r.indicador_id + "-" + r.anio + "-" + (r.mes ?? "null"))
  );
  let indVencidos = 0;
  for (const ind of indicadores ?? []) {
    if (ind.frecuencia === "anual") {
      if (!registroSet.has(ind.id + "-" + anio + "-null")) indVencidos++;
    } else {
      const mesPrevio = mes === 1 ? 12 : mes - 1;
      const anioPrevio = mes === 1 ? anio - 1 : anio;
      if (!registroSet.has(ind.id + "-" + anioPrevio + "-" + mesPrevio)) indVencidos++;
    }
  }

  // Procedimientos del módulo propio
  let procVencidosCount = 0;
  try {
    const { data: allProcs } = await admin
      .from("proc_procedimientos")
      .select("id")
      .eq("activo", true);
    const pIds = (allProcs ?? []).map((p: { id: string }) => p.id);
    if (pIds.length > 0) {
      const { data: revs } = await admin
        .from("proc_revisiones")
        .select("procedimiento_id, fecha_vencimiento")
        .in("procedimiento_id", pIds)
        .order("fecha_revision", { ascending: false });
      const latestMap: Record<string, string | null> = {};
      for (const r of revs ?? []) {
        const rev = r as { procedimiento_id: string; fecha_vencimiento: string };
        if (!latestMap[rev.procedimiento_id]) latestMap[rev.procedimiento_id] = rev.fecha_vencimiento;
      }
      const hoyP = new Date(); hoyP.setHours(0, 0, 0, 0);
      for (const p of allProcs ?? []) {
        const pr = p as { id: string };
        const fv = latestMap[pr.id] ? new Date(latestMap[pr.id]! + "T00:00:00") : null;
        if (!fv || fv < hoyP) procVencidosCount++;
      }
    }
  } catch {
    // tabla no existe aún — se muestra 0
  }

  function formatFechaCorta(d: Date) {
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <MetricCard title="Total documentos" value={total} icon={FileText}
            iconColor="text-blue-500" bgColor="bg-blue-50" href="/items" />
          <MetricCard title="Vencidos" value={vencidosTotal} icon={AlertTriangle}
            iconColor="text-red-500" bgColor="bg-red-50"
            subtitle={sinArchivo > 0 ? `${vencidosReales ?? 0} reales + ${sinArchivo} sin archivo` : `${vencidosReales ?? 0} vencidos`}
            alert={vencidosTotal > 0} href="#vencidos-detalle" />
          <MetricCard title="% cumplimiento" value={`${cumplimiento}%`}
            icon={cumplimiento >= 80 ? CheckCircle2 : cumplimiento >= 50 ? AlertTriangle : XCircle}
            iconColor={cumplimiento >= 80 ? "text-green-500" : cumplimiento >= 50 ? "text-yellow-500" : "text-red-500"}
            bgColor={cumplimiento >= 80 ? "bg-green-50" : cumplimiento >= 50 ? "bg-yellow-50" : "bg-red-50"}
            subtitle={totalConBorradores === 0 ? "Sin documentos cargados" : `${vigentes ?? 0} vigentes`}
            alert={cumplimiento < 50} />
          <MetricCard title="Sin procedimiento" value={sinProcedimiento} icon={BookOpen}
            iconColor={sinProcedimiento > 0 ? "text-orange-500" : "text-green-500"}
            bgColor={sinProcedimiento > 0 ? "bg-orange-50" : "bg-green-50"}
            subtitle={`De ${todosItems?.length ?? 0} items en total`}
            alert={sinProcedimiento > 0} href="#sin-procedimiento" />
          <MetricCard title="Procedimientos" value={procVencidosCount} icon={ClipboardList}
            iconColor={procVencidosCount > 0 ? "text-red-500" : "text-green-500"}
            bgColor={procVencidosCount > 0 ? "bg-red-50" : "bg-green-50"}
            subtitle={procVencidosCount > 0 ? "vencidos o sin revisión" : "todos al día"}
            alert={procVencidosCount > 0} href="/procedimientos" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/calibracion" className="block hover:opacity-90 transition-opacity">
            <Card className={calibVencidos > 0 ? "border-red-200 bg-red-50/30" : "border-green-200 bg-green-50/20"}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={"flex items-center justify-center w-12 h-12 rounded-xl shrink-0 " + (calibVencidos > 0 ? "bg-red-100" : "bg-green-100")}>
                  <Wrench className={"w-6 h-6 " + (calibVencidos > 0 ? "text-red-500" : "text-green-500")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Calibraciones</p>
                  <div className="flex items-baseline gap-2">
                    <p className={"text-3xl font-bold " + (calibVencidos > 0 ? "text-red-600" : "text-green-600")}>
                      {calibVencidos > 0 ? calibVencidos : "OK"}
                    </p>
                    {calibVencidos > 0 && <span className="text-xs text-muted-foreground">{calibVencidos !== 1 ? "vencidas" : "vencida"}</span>}
                  </div>
                  {calibVencidos > 0 && calibPrimerVencido
                    ? <p className="text-xs text-red-500 font-medium mt-0.5">Primer vencido: {formatFechaCorta(calibPrimerVencido)}</p>
                    : calibVencidos > 0
                    ? <p className="text-xs text-red-500 font-medium mt-0.5">Sin registro de calibración</p>
                    : <p className="text-xs text-green-600 mt-0.5">Todos al día</p>
                  }
                </div>
                {calibVencidos > 0
                  ? <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                  : <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />}
              </CardContent>
            </Card>
          </Link>

          <Link href="/indicadores" className="block hover:opacity-90 transition-opacity">
            <Card className={indVencidos > 0 ? "border-red-200 bg-red-50/30" : "border-green-200 bg-green-50/20"}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={"flex items-center justify-center w-12 h-12 rounded-xl shrink-0 " + (indVencidos > 0 ? "bg-red-100" : "bg-green-100")}>
                  <BarChart2 className={"w-6 h-6 " + (indVencidos > 0 ? "text-red-500" : "text-green-500")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Indicadores</p>
                  <div className="flex items-baseline gap-2">
                    <p className={"text-3xl font-bold " + (indVencidos > 0 ? "text-red-600" : "text-green-600")}>
                      {indVencidos > 0 ? indVencidos : "OK"}
                    </p>
                    {indVencidos > 0 && <span className="text-xs text-muted-foreground">sin cargar</span>}
                  </div>
                  {indVencidos > 0
                    ? <p className="text-xs text-red-500 font-medium mt-0.5">{indVencidos} indicador{indVencidos !== 1 ? "es" : ""} con dato vencido</p>
                    : <p className="text-xs text-green-600 mt-0.5">Todos al día</p>
                  }
                </div>
                {indVencidos > 0
                  ? <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                  : <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />}
              </CardContent>
            </Card>
          </Link>
        </div>

        {(vencidosTotal > 0 || sinProcedimiento > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
          <div className="xl:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Items vencidos más urgentes
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/items?estado=vencido">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link>
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild><Link href="/items/nuevo">Nuevo documento</Link></Button>
            <Button variant="outline" asChild><Link href="/items?estado=por_vencer">Ver próximos a vencer</Link></Button>
            <Button variant="outline" asChild><Link href="/admin/clausulas">Mapa de cláusulas ISO</Link></Button>
            <Button variant="outline" asChild><Link href="/vencimientos">Calendario de vencimientos</Link></Button>
            <Button variant="outline" asChild><Link href="/procedimientos">Procedimientos</Link></Button>
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
    alta: "creó", edicion: "editó", descarga: "descargó",
    renovacion: "renovó", aprobacion: "aprobó", rechazo: "rechazó",
    importacion_masiva: "importó",
  };
  return labels[accion] ?? accion;
}
