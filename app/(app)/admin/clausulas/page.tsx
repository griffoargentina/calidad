import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AgregarClausulaDialog } from "@/components/admin/agregar-clausula-dialog";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, FileText } from "lucide-react";

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

  const [{ data: todosItems }, { data: todosArchivos }] = await Promise.all([
    supabase
      .from("items")
      .select("id, clausula_iso, estado, fecha_vencimiento")
      .neq("estado", "obsoleto"),
    supabase
      .from("archivos")
      .select("item_id, categoria"),
  ]);

  // Qué items tienen al menos un documento (categoria != procedimiento)
  const itemsConDoc = new Set(
    (todosArchivos ?? [])
      .filter((a) => a.categoria !== "procedimiento")
      .map((a) => a.item_id)
  );

  const clausulaStats: Record<string, {
    total: number; sinArchivo: number; vencidos: number; porVencer: number;
  }> = {};

  for (const item of todosItems ?? []) {
    const cid = item.clausula_iso;
    if (!clausulaStats[cid]) clausulaStats[cid] = { total: 0, sinArchivo: 0, vencidos: 0, porVencer: 0 };
    const s = clausulaStats[cid];
    s.total++;

    if (!itemsConDoc.has(item.id)) {
      s.sinArchivo++;
    } else {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const fv = item.fecha_vencimiento ? new Date(item.fecha_vencimiento + "T00:00:00") : null;
      if (!fv || fv < hoy) {
        s.vencidos++;
      } else if (fv <= new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        s.porVencer++;
      }
    }
  }

  function getSemaforo(clausulaId: string) {
    const s = clausulaStats[clausulaId];
    if (!s || s.total === 0)      return "rojo";
    if (s.sinArchivo > 0)         return "rojo";
    if (s.vencidos > 0)           return "rojo";
    if (s.porVencer > 0)          return "amarillo";
    return "verde";
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Mapa de cobertura — Cláusulas ISO 9001:2015"
        actions={<AgregarClausulaDialog />}
      />
      <div className="flex-1 p-6 space-y-4">
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> Todo vigente</span>
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-yellow-500" /> Por vencer</span>
          <span className="flex items-center gap-1.5"><XCircle className="h-4 w-4 text-red-500" /> Vencido o sin archivo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {clausulas?.map((c) => {
            const semaforo = getSemaforo(c.id);
            const stats = clausulaStats[c.id];
            const problemas = (stats?.sinArchivo ?? 0) + (stats?.vencidos ?? 0);

            return (
              <Link key={c.id} href={`/admin/clausulas/${c.id}`}>
                <Card className={`h-full transition-all hover:shadow-md cursor-pointer ${
                  semaforo === "rojo"     ? "border-red-200 bg-red-50/40" :
                  semaforo === "amarillo" ? "border-yellow-200 bg-yellow-50/40" :
                  "border-green-200 bg-green-50/20"
                }`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs shrink-0">{c.id}</Badge>
                        {(c.relacionadas as string[] | null)?.map((r: string) => (
                          <span key={r} className="font-mono text-[10px] text-muted-foreground">({r})</span>
                        ))}
                      </div>
                      {semaforo === "verde"    && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {semaforo === "amarillo" && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                      {semaforo === "rojo"     && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-xs font-medium leading-snug mb-3">{c.titulo}</p>
                    {!stats || stats.total === 0 ? (
                      <p className="text-xs text-red-500 font-medium">Sin documentos</p>
                    ) : (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {stats.total}
                        </span>
                        {problemas > 0 && (
                          <span className="text-red-600 font-medium">{problemas} con problema</span>
                        )}
                        {stats.porVencer > 0 && (
                          <span className="text-yellow-600">{stats.porVencer} por vencer</span>
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
