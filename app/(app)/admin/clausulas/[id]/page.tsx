import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { TIPO_ITEM_LABELS, TIPO_ITEM_CLAUSULA_PRINCIPAL } from "@/lib/constants/items";
import { TipoItem, EstadoItem } from "@/types/database";
import { formatFecha } from "@/lib/utils/format";
import {
  CheckCircle2, AlertTriangle, XCircle, Plus, ArrowLeft, FileText, ChevronRight
} from "lucide-react";
import Link from "next/link";

export default async function ClausulaDetallePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") redirect("/dashboard");

  const admin = createAdminClient();

  const [{ data: clausula }, { data: items }] = await Promise.all([
    admin.from("clausulas_iso").select("*").eq("id", params.id).single(),
    admin.from("items")
      .select("id, codigo, titulo, tipo, estado, fecha_vencimiento, es_borrador")
      .eq("clausula_iso", params.id)
      .eq("es_borrador", false)
      .order("tipo"),
  ]);

  if (!clausula) redirect("/admin/clausulas");

  // Tipos de documento que pertenecen a esta cláusula según el estándar
  const tiposEsperados = (Object.entries(TIPO_ITEM_CLAUSULA_PRINCIPAL) as [TipoItem, string][])
    .filter(([, clausulaId]) => clausulaId === params.id)
    .map(([tipo]) => tipo);

  // Agrupar items existentes por tipo
  const itemsByTipo = new Map<TipoItem, typeof items>();
  for (const tipo of tiposEsperados) {
    itemsByTipo.set(tipo, items?.filter((i) => i.tipo === tipo) ?? []);
  }

  function getSemaforoPorTipo(tipo: TipoItem) {
    const its = itemsByTipo.get(tipo) ?? [];
    if (its.length === 0) return "rojo";
    if (its.some((i) => i.estado === "vencido")) return "rojo";
    if (its.some((i) => i.estado === "por_vencer")) return "amarillo";
    return "verde";
  }

  const totalTipos = tiposEsperados.length;
  const verdes = tiposEsperados.filter((t) => getSemaforoPorTipo(t) === "verde").length;
  const amarillos = tiposEsperados.filter((t) => getSemaforoPorTipo(t) === "amarillo").length;
  const rojos = tiposEsperados.filter((t) => getSemaforoPorTipo(t) === "rojo").length;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={`Cláusula ${clausula.id}`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/clausulas">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* Header de la cláusula */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-sm px-3 py-1">{clausula.id}</Badge>
            <h2 className="text-xl font-semibold">{clausula.titulo}</h2>
          </div>
          {clausula.descripcion && (
            <p className="text-sm text-muted-foreground">{clausula.descripcion}</p>
          )}
        </div>

        {/* Resumen de cobertura */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-lg border bg-green-50 border-green-200 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-green-700">{verdes}</p>
              <p className="text-xs text-green-600">Vigente{verdes !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-yellow-50 border-yellow-200 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{amarillos}</p>
              <p className="text-xs text-yellow-600">Por vencer</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-red-50 border-red-200 px-4 py-3">
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-red-700">{rojos}</p>
              <p className="text-xs text-red-600">Sin evidencia / vencido</p>
            </div>
          </div>
        </div>

        {/* Lista de tipos de documento esperados */}
        {tiposEsperados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No hay tipos de documento definidos para esta cláusula en el sistema.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              {totalTipos} tipo{totalTipos !== 1 ? "s" : ""} de documento requerido{totalTipos !== 1 ? "s" : ""}
            </p>
            {tiposEsperados.map((tipo) => {
              const its = itemsByTipo.get(tipo) ?? [];
              const semaforo = getSemaforoPorTipo(tipo);

              return (
                <div
                  key={tipo}
                  className={`rounded-lg border ${
                    semaforo === "verde" ? "border-green-200 bg-green-50/30" :
                    semaforo === "amarillo" ? "border-yellow-200 bg-yellow-50/30" :
                    "border-red-200 bg-red-50/30"
                  }`}
                >
                  {/* Cabecera del tipo */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {semaforo === "verde" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {semaforo === "amarillo" && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                      {semaforo === "rojo" && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      <span className="text-sm font-medium">{TIPO_ITEM_LABELS[tipo]}</span>
                      {its.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{its.length}</Badge>
                      )}
                    </div>
                    <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                      <Link href={`/items/nuevo?tipo=${tipo}&clausula=${params.id}`}>
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar
                      </Link>
                    </Button>
                  </div>

                  {/* Items existentes */}
                  {its.length === 0 ? (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-red-500 font-medium">Sin evidencia — ningún documento cargado</p>
                    </div>
                  ) : (
                    <ul className="border-t divide-y">
                      {its.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={`/items/${item.id}`}
                            className="flex items-center gap-4 px-4 py-2.5 hover:bg-white/60 transition-colors"
                          >
                            <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{item.codigo}</span>
                            <span className="flex-1 text-sm truncate">{item.titulo}</span>
                            <EstadoBadge estado={item.estado as EstadoItem} />
                            <span className="text-xs text-muted-foreground shrink-0">
                              {item.fecha_vencimiento ? formatFecha(item.fecha_vencimiento) : "Sin vencimiento"}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
