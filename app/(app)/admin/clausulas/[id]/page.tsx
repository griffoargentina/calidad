import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import { EstadoItem } from "@/types/database";
import { formatFecha } from "@/lib/utils/format";
import {
  CheckCircle2, XCircle, Plus, ArrowLeft,
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
      .select("id, codigo, codigo_formal, titulo, tipo, estado, fecha_vencimiento, es_borrador")
      .eq("clausula_iso", params.id)
      .neq("estado", "obsoleto")
      .order("es_borrador", { ascending: true })
      .order("updated_at", { ascending: false }),
  ]);

  if (!clausula) redirect("/admin/clausulas");

  const publicados = items?.filter((i) => !i.es_borrador) ?? [];
  const borradores = items?.filter((i) => i.es_borrador) ?? [];

  let semaforo = "sin_evidencia";
  if (publicados.length > 0) {
    if (publicados.some((i) => i.estado === "vencido")) semaforo = "vencido";
    else if (publicados.some((i) => i.estado === "por_vencer")) semaforo = "por_vencer";
    else semaforo = "vigente";
  } else if (borradores.length > 0) {
    semaforo = "borrador";
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={`${clausula.id} — ${clausula.titulo}`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/clausulas">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-3xl mx-auto w-full">

        {/* Estado general */}
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
          semaforo === "vigente"      ? "border-green-200 bg-green-50" :
          semaforo === "por_vencer"   ? "border-yellow-200 bg-yellow-50" :
          semaforo === "vencido"      ? "border-red-200 bg-red-50" :
          semaforo === "borrador"     ? "border-slate-200 bg-slate-50" :
          "border-red-200 bg-red-50"
        }`}>
          {semaforo === "vigente"    && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
          {semaforo === "por_vencer" && <Clock className="h-5 w-5 text-yellow-500 shrink-0" />}
          {semaforo === "vencido"    && <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
          {semaforo === "borrador"   && <PenLine className="h-5 w-5 text-slate-400 shrink-0" />}
          {semaforo === "sin_evidencia" && <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
          <div>
            <p className={`text-sm font-medium ${
              semaforo === "vigente"      ? "text-green-700" :
              semaforo === "por_vencer"   ? "text-yellow-700" :
              semaforo === "vencido"      ? "text-red-700" :
              semaforo === "borrador"     ? "text-slate-600" :
              "text-red-700"
            }`}>
              {semaforo === "vigente"      && "Evidencia vigente"}
              {semaforo === "por_vencer"   && "Evidencia por vencer"}
              {semaforo === "vencido"      && "Evidencia vencida"}
              {semaforo === "borrador"     && "Placeholder cargado — pendiente de completar"}
              {semaforo === "sin_evidencia" && "Sin evidencia — no hay documentos para esta cláusula"}
            </p>
            {clausula.descripcion && (
              <p className="text-xs text-muted-foreground mt-0.5">{clausula.descripcion}</p>
            )}
          </div>
        </div>

        {/* Documentos publicados */}
        {publicados.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Documentos publicados ({publicados.length})
            </p>
            <div className="rounded-lg border divide-y">
              {publicados.map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-muted-foreground">{item.codigo}</span>
                      {item.codigo_formal && (
                        <span className="text-xs text-muted-foreground">· {item.codigo_formal}</span>
                      )}
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {TIPO_ITEM_LABELS[item.tipo as keyof typeof TIPO_ITEM_LABELS]}
                      </Badge>
                    </div>
                  </div>
                  <EstadoBadge estado={item.estado as EstadoItem} />
                  <span className="text-xs text-muted-foreground shrink-0 w-24 text-right">
                    {item.fecha_vencimiento ? formatFecha(item.fecha_vencimiento) : "Sin venc."}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Borradores / placeholders */}
        {borradores.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Borradores / pendientes ({borradores.length})
            </p>
            <div className="rounded-lg border divide-y border-dashed">
              {borradores.map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <PenLine className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-slate-600">{item.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-muted-foreground">{item.codigo}</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {TIPO_ITEM_LABELS[item.tipo as keyof typeof TIPO_ITEM_LABELS]}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs text-slate-500 border-slate-300 shrink-0">
                    Borrador
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Agregar documento */}
        <div className="flex justify-end pt-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/items/nuevo?clausula=${params.id}`}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar documento
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
