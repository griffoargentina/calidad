import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AgregarClausulaDialog } from "@/components/admin/agregar-clausula-dialog";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, FileText, User, Calendar } from "lucide-react";

export default async function ClausulasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") redirect("/dashboard");

  const { data: clausulasRaw } = await supabase.from("clausulas_iso").select("*");

  const clausulas = (clausulasRaw ?? []).sort((a, b) => {
    const pa = a.id.split(".").map(Number);
    const pb = b.id.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  const [{ data: todosItems }, { data: todosArchivos }, { data: ultimasCalibraciones }] = await Promise.all([
    supabase
      .from("items")
      .select("id, clausula_iso, estado, fecha_vencimiento, metadata, usuarios!responsable_id(nombre)")
      .neq("estado", "obsoleto"),
    supabase
      .from("archivos")
      .select("item_id, categoria"),
    supabase
      .from("calibraciones")
      .select("equipo_id, fecha_vencimiento")
      .order("fecha_calibracion", { ascending: false }),
  ]);

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const en30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Semáforo de calibración para 7.1.5
  const seenEquipos = new Set<string>();
  let calibVencidos = 0;
  for (const c of ultimasCalibraciones ?? []) {
    if (seenEquipos.has(c.equipo_id)) continue;
    seenEquipos.add(c.equipo_id);
    const fv = c.fecha_vencimiento ? new Date(c.fecha_vencimiento + "T00:00:00") : null;
    if (!fv || fv < hoy) calibVencidos++;
  }

  const itemsConDoc = new Set(
    (todosArchivos ?? [])
      .filter((a) => a.categoria !== "procedimiento")
      .map((a) => a.item_id)
  );

  type ClausulaStats = {
    total: number;
    sinArchivo: number;
    vencidos: number;
    porVencer: number;
    vigentes: number;
    responsables: Set<string>;
    proximoVencimiento: Date | null;
  };

  const clausulaStats: Record<string, ClausulaStats> = {};

  for (const item of todosItems ?? []) {
    const cid = item.clausula_iso;
    if (!clausulaStats[cid]) {
      clausulaStats[cid] = { total: 0, sinArchivo: 0, vencidos: 0, porVencer: 0, vigentes: 0, responsables: new Set(), proximoVencimiento: null };
    }
    const s = clausulaStats[cid];
    s.total++;

    const resp = Array.isArray(item.usuarios) ? item.usuarios[0]?.nombre : (item.usuarios as { nombre: string } | null)?.nombre;
    if (resp) s.responsables.add(resp);

    const iMeta = (item.metadata ?? {}) as Record<string, unknown>;
    const docOk = itemsConDoc.has(item.id) || iMeta.documento_na === true;
    const fv = item.fecha_vencimiento ? new Date(item.fecha_vencimiento + "T00:00:00") : null;

    if (!docOk) {
      s.sinArchivo++;
    } else if (!fv || fv < hoy) {
      s.vencidos++;
      if (fv && (!s.proximoVencimiento || fv > s.proximoVencimiento)) {
        s.proximoVencimiento = fv;
      }
    } else if (fv <= en30) {
      s.porVencer++;
      if (!s.proximoVencimiento || fv < s.proximoVencimiento) {
        s.proximoVencimiento = fv;
      }
    } else {
      s.vigentes++;
    }
  }

  function getSemaforo(clausulaId: string) {
    if (clausulaId === "7.1.5") return calibVencidos > 0 ? "rojo" : "verde";
    const s = clausulaStats[clausulaId];
    if (!s || s.total === 0)  return "rojo";
    if (s.sinArchivo > 0)     return "rojo";
    if (s.vencidos > 0)       return "rojo";
    if (s.porVencer > 0)      return "amarillo";
    return "verde";
  }

  function formatFechaCorta(d: Date) {
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Mapa de cobertura — Cláusulas ISO 9001:2015"
        actions={<AgregarClausulaDialog />}
      />
      <div className="flex-1 p-6 space-y-4">
        <div className="flex gap-5 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Todo vigente</span>
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-yellow-500" /> Por vencer (30 días)</span>
          <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-red-500" /> Vencido o sin archivo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {clausulas?.map((c) => {
            const semaforo = getSemaforo(c.id);
            const stats = clausulaStats[c.id];
            const problemas = (stats?.sinArchivo ?? 0) + (stats?.vencidos ?? 0);
            const responsablesArr = stats ? Array.from(stats.responsables) : [];

            const href = c.id === "7.1.5" ? "/calibracion" : `/admin/clausulas/${c.id}`;

            const borderColor =
              semaforo === "rojo"     ? "border-red-200"    :
              semaforo === "amarillo" ? "border-yellow-200" : "border-green-200";
            const bgColor =
              semaforo === "rojo"     ? "bg-red-50/30"      :
              semaforo === "amarillo" ? "bg-yellow-50/30"   : "bg-green-50/20";

            return (
              <Link key={c.id} href={href}>
                <Card className={`h-full transition-all hover:shadow-md cursor-pointer border ${borderColor} ${bgColor}`}>
                  {/* Header: ID + semáforo */}
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs shrink-0 font-semibold">{c.id}</Badge>
                        {(c.relacionadas as string[] | null)?.map((r: string) => (
                          <span key={r} className="font-mono text-[10px] text-muted-foreground">({r})</span>
                        ))}
                      </div>
                      {semaforo === "verde"    && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {semaforo === "amarillo" && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                      {semaforo === "rojo"     && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Título */}
                    <p className="text-xs font-semibold leading-snug text-slate-800">{c.titulo}</p>

                    {c.id === "7.1.5" ? (
                      <div className="space-y-1.5">
                        <p className="text-xs">
                          {calibVencidos > 0
                            ? <span className="text-red-600 font-medium">{calibVencidos} equipo{calibVencidos !== 1 ? "s" : ""} vencido{calibVencidos !== 1 ? "s" : ""}</span>
                            : <span className="text-green-600 font-medium">Todos los equipos al día</span>
                          }
                        </p>
                      </div>
                    ) : !stats || stats.total === 0 ? (
                      <p className="text-xs text-red-500 font-medium">Sin documentos registrados</p>
                    ) : (
                      <div className="space-y-2.5">
                        {/* Contadores */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            <FileText className="h-2.5 w-2.5" /> {stats.total} docs
                          </span>
                          {stats.vigentes > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                              {stats.vigentes} vigente{stats.vigentes !== 1 ? "s" : ""}
                            </span>
                          )}
                          {stats.porVencer > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">
                              {stats.porVencer} por vencer
                            </span>
                          )}
                          {(stats.vencidos + stats.sinArchivo) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                              {stats.vencidos + stats.sinArchivo} con problema
                            </span>
                          )}
                        </div>

                        {/* Próximo vencimiento */}
                        {stats.proximoVencimiento && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="h-2.5 w-2.5 shrink-0" />
                            <span className={problemas > 0 ? "text-red-500 font-medium" : "text-yellow-600 font-medium"}>
                              {problemas > 0 ? "Vencido: " : "Vence: "}
                              {formatFechaCorta(stats.proximoVencimiento)}
                            </span>
                          </div>
                        )}

                        {/* Responsables */}
                        {responsablesArr.length > 0 && (
                          <div className="flex items-start gap-1 text-[10px] text-muted-foreground">
                            <User className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                            <span className="leading-tight">
                              {responsablesArr.slice(0, 2).join(", ")}
                              {responsablesArr.length > 2 && ` +${responsablesArr.length - 2}`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
