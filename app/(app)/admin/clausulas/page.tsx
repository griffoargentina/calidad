import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, FileText } from "lucide-react";

export default async function ClausulasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") redirect("/dashboard");

  const { data: clausulas } = await supabase.from("clausulas_iso").select("*").order("id");

  // Contar items por cláusula y su peor estado
  const { data: itemsPorClausula } = await supabase
    .from("items")
    .select("clausula_iso, estado")
    .eq("es_borrador", false)
    .neq("estado", "obsoleto");

  const clausulaStats: Record<string, { total: number; vencidos: number; porVencer: number; vigentes: number }> = {};

  for (const item of itemsPorClausula ?? []) {
    if (!clausulaStats[item.clausula_iso]) {
      clausulaStats[item.clausula_iso] = { total: 0, vencidos: 0, porVencer: 0, vigentes: 0 };
    }
    const s = clausulaStats[item.clausula_iso];
    s.total++;
    if (item.estado === "vencido") s.vencidos++;
    else if (item.estado === "por_vencer") s.porVencer++;
    else if (item.estado === "vigente") s.vigentes++;
  }

  function getSemaforo(clausulaId: string) {
    const s = clausulaStats[clausulaId];
    if (!s || s.total === 0) return "gris";
    if (s.vencidos > 0) return "rojo";
    if (s.porVencer > 0) return "amarillo";
    return "verde";
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Mapa de cobertura — Cláusulas ISO 9001:2015" />
      <div className="flex-1 p-6 space-y-4">
        {/* Leyenda */}
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> Todo vigente</span>
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-yellow-500" /> Alguno por vencer</span>
          <span className="flex items-center gap-1.5"><XCircle className="h-4 w-4 text-red-500" /> Vencido o sin evidencia</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {clausulas?.map((c) => {
            const semaforo = getSemaforo(c.id);
            const stats = clausulaStats[c.id];

            return (
              <Link key={c.id} href={`/items?clausula=${c.id}`}>
                <Card className={`h-full transition-all hover:shadow-md cursor-pointer ${
                  semaforo === "rojo" ? "border-red-200 bg-red-50/40" :
                  semaforo === "amarillo" ? "border-yellow-200 bg-yellow-50/40" :
                  semaforo === "verde" ? "border-green-200 bg-green-50/20" :
                  "border-slate-200"
                }`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="font-mono text-xs shrink-0">{c.id}</Badge>
                      {semaforo === "verde" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {semaforo === "amarillo" && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                      {semaforo === "rojo" && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      {semaforo === "gris" && <XCircle className="h-4 w-4 text-slate-300 shrink-0" />}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-xs font-medium leading-snug mb-3">{c.titulo}</p>
                    {stats ? (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {stats.total}
                        </span>
                        {stats.vencidos > 0 && (
                          <span className="text-red-600 font-medium">{stats.vencidos} vencidos</span>
                        )}
                        {stats.porVencer > 0 && (
                          <span className="text-yellow-600">{stats.porVencer} por vencer</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin documentos</p>
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
