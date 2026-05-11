import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import { CLAUSULA_REQUISITOS } from "@/lib/constants/clausula-requisitos";
import { EstadoItem } from "@/types/database";
import { formatFecha } from "@/lib/utils/format";
import {
  CheckCircle2, AlertTriangle, XCircle, Plus, ArrowLeft,
  FileText, ChevronRight, Clock, PenLine
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
      .neq("estado", "obsoleto")
      .order("es_borrador", { ascending: true })
      .order("tipo"),
  ]);

  if (!clausula) redirect("/admin/clausulas");

  const requisitos = CLAUSULA_REQUISITOS[params.id] ?? [];

  // Separar publicados y borradores
  const itemsPublicados = items?.filter((i) => !i.es_borrador) ?? [];
  const itemsBorrador = items?.filter((i) => i.es_borrador) ?? [];

  // Para cada requisito, buscar los items que lo cubren (mismo tipo)
  const publicadosByTipo = new Map<string, typeof itemsPublicados>();
  const borradoresByTipo = new Map<string, typeof itemsBorrador>();
  for (const req of requisitos) {
    if (req.tipo_item) {
      publicadosByTipo.set(req.tipo_item, itemsPublicados.filter((i) => i.tipo === req.tipo_item));
      borradoresByTipo.set(req.tipo_item, itemsBorrador.filter((i) => i.tipo === req.tipo_item));
    }
  }

  function getEstadoRequisito(req: (typeof requisitos)[0]) {
    if (!req.tipo_item) return "sin_tipo";
    const pub = publicadosByTipo.get(req.tipo_item) ?? [];
    const bor = borradoresByTipo.get(req.tipo_item) ?? [];
    if (pub.length === 0 && bor.length === 0) return "sin_evidencia";
    if (pub.length === 0 && bor.length > 0) return "borrador";
    if (pub.some((i) => i.estado === "vencido")) return "vencido";
    if (pub.some((i) => i.estado === "por_vencer")) return "por_vencer";
    return "vigente";
  }

  const vigentes = requisitos.filter((r) => getEstadoRequisito(r) === "vigente").length;
  const porVencer = requisitos.filter((r) => getEstadoRequisito(r) === "por_vencer").length;
  const pendientes = requisitos.filter((r) => getEstadoRequisito(r) === "borrador").length;
  const sinEvidencia = requisitos.filter((r) =>
    getEstadoRequisito(r) === "sin_evidencia" || getEstadoRequisito(r) === "vencido"
  ).length;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={`Cláusula ${clausula.id} — ${clausula.titulo}`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/clausulas">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver al mapa
            </Link>
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* Descripción */}
        {clausula.descripcion && (
          <p className="text-sm text-muted-foreground border-l-4 border-primary/30 pl-3">
            {clausula.descripcion}
          </p>
        )}

        {/* Resumen */}
        <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center gap-3 rounded-lg border bg-green-50 border-green-200 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-green-700">{vigentes}</p>
              <p className="text-xs text-green-600">Vigente</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-yellow-50 border-yellow-200 px-4 py-3">
            <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{porVencer}</p>
              <p className="text-xs text-yellow-600">Por vencer</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-slate-50 border-slate-200 px-4 py-3">
            <PenLine className="h-5 w-5 text-slate-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-slate-600">{pendientes}</p>
              <p className="text-xs text-slate-500">Pendiente (borrador)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-red-50 border-red-200 px-4 py-3">
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-red-700">{sinEvidencia}</p>
              <p className="text-xs text-red-600">Sin evidencia</p>
            </div>
          </div>
        </div>

        {/* Requisitos */}
        {requisitos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No hay requisitos definidos para esta cláusula.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              {requisitos.length} requisito{requisitos.length !== 1 ? "s" : ""} ISO para esta cláusula
            </p>

            {requisitos.map((req) => {
              const estado = getEstadoRequisito(req);
              const pub = req.tipo_item ? (publicadosByTipo.get(req.tipo_item) ?? []) : [];
              const bor = req.tipo_item ? (borradoresByTipo.get(req.tipo_item) ?? []) : [];
              const its = [...pub, ...bor];

              const borderColor =
                estado === "vigente"     ? "border-green-200 bg-green-50/20" :
                estado === "por_vencer"  ? "border-yellow-200 bg-yellow-50/20" :
                estado === "borrador"    ? "border-slate-200 bg-slate-50/30" :
                estado === "sin_evidencia" || estado === "vencido" ? "border-red-200 bg-red-50/20" :
                "border-slate-200 bg-slate-50/20";

              return (
                <div key={req.id} className={`rounded-lg border ${borderColor}`}>
                  {/* Cabecera del requisito */}
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 shrink-0">
                      {estado === "vigente"    && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {estado === "por_vencer" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                      {estado === "borrador"   && <PenLine className="h-4 w-4 text-slate-400" />}
                      {(estado === "sin_evidencia" || estado === "vencido") && <XCircle className="h-4 w-4 text-red-500" />}
                      {estado === "sin_tipo"   && <div className="h-4 w-4 rounded-full border-2 border-slate-300" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {req.id}
                        </span>
                        {req.tipo_item && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            {TIPO_ITEM_LABELS[req.tipo_item]}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{req.descripcion}</p>

                      {/* Estado de evidencia */}
                      {estado === "sin_evidencia" && req.tipo_item && (
                        <p className="text-xs text-red-500 mt-1 font-medium">
                          Sin evidencia — no hay documentos de este tipo cargados
                        </p>
                      )}
                      {estado === "borrador" && (
                        <p className="text-xs text-slate-500 mt-1">
                          Borrador — pendiente de completar y publicar
                        </p>
                      )}
                      {estado === "sin_tipo" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Requisito de proceso — verificar en auditoría interna
                        </p>
                      )}
                    </div>

                    {req.tipo_item && (
                      <Button asChild size="sm" variant="ghost" className="h-7 text-xs shrink-0">
                        <Link href={`/items/nuevo?tipo=${req.tipo_item}&clausula=${params.id}`}>
                          <Plus className="h-3 w-3 mr-1" />
                          Agregar
                        </Link>
                      </Button>
                    )}
                  </div>

                  {/* Items que cubren este requisito */}
                  {its.length > 0 && (
                    <ul className="border-t divide-y">
                      {its.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={`/items/${item.id}`}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/60 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                              {item.codigo}
                            </span>
                            <span className="flex-1 text-sm truncate">{item.titulo}</span>
                            {item.es_borrador
                              ? <Badge variant="outline" className="text-xs text-slate-500 border-slate-300">Borrador</Badge>
                              : <EstadoBadge estado={item.estado as EstadoItem} />
                            }
                            <span className="text-xs text-muted-foreground shrink-0">
                              {item.fecha_vencimiento ? formatFecha(item.fecha_vencimiento) : "Sin venc."}
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
