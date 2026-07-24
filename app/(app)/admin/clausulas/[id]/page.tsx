import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import { formatFecha } from "@/lib/utils/format";
import {
  CheckCircle2, XCircle, Plus, ArrowLeft,
  FileText, ChevronRight, Clock, BookOpen, Calendar,
} from "lucide-react";
import Link from "next/link";
import { EliminarClausulaButton } from "@/components/admin/eliminar-clausula-button";
import { ClausulasRelacionadasEditor } from "@/components/admin/clausulas-relacionadas-editor";
import { EditClausulaButton } from "@/components/admin/edit-clausula-button";

export default async function ClausulaDetallePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  const isAdmin = usuario?.rol === "admin";

  const admin = createAdminClient();

  const [{ data: clausula }, { data: items }] = await Promise.all([
    admin.from("clausulas_iso").select("*").eq("id", params.id).single(),
    admin.from("items")
      .select("id, codigo, titulo, tipo, estado, fecha_vencimiento, metadata")
      .eq("clausula_iso", params.id)
      .neq("estado", "obsoleto")
      .order("updated_at", { ascending: false }),
  ]);

  if (!clausula) redirect("/admin/clausulas");

  // Cláusulas con páginas propias
  if (params.id === "7.1.5") redirect("/calibracion");
  if (params.id === "6.2")   redirect("/indicadores");

  // Fetch archivos for all items in this clause to build semáforos
  const itemIds = items?.map((i) => i.id) ?? [];
  const { data: archivos } = itemIds.length > 0
    ? await admin.from("archivos").select("item_id, categoria").in("item_id", itemIds)
    : { data: [] as Array<{ item_id: string; categoria: string | null }> };

  const tieneDoc:  Record<string, boolean> = {};
  const tieneProc: Record<string, boolean> = {};
  for (const a of archivos ?? []) {
    if (a.categoria === "procedimiento") tieneProc[a.item_id] = true;
    else tieneDoc[a.item_id] = true;
  }

  const hoyClausula = new Date(); hoyClausula.setHours(0, 0, 0, 0);
  const en7dias = new Date(hoyClausula.getTime() + 7 * 24 * 60 * 60 * 1000);
  let semaforo = "sin_evidencia";
  if ((items?.length ?? 0) > 0) {
    const allItems = items ?? [];
    const anyVencido = allItems.some((i) => {
      const iMeta = (i.metadata ?? {}) as Record<string, unknown>;
      const iDocOk = tieneDoc[i.id] || iMeta.documento_na === true;
      if (!iDocOk) return true;
      const fv = i.fecha_vencimiento ? new Date(i.fecha_vencimiento + "T00:00:00") : null;
      return fv ? fv < hoyClausula : true;
    });
    const anyPorVencer = !anyVencido && allItems.some((i) => {
      const fv = i.fecha_vencimiento ? new Date(i.fecha_vencimiento + "T00:00:00") : null;
      return fv ? fv >= hoyClausula && fv <= en7dias : false;
    });
    if (anyVencido)        semaforo = "vencido";
    else if (anyPorVencer) semaforo = "por_vencer";
    else                   semaforo = "vigente";
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={`${clausula.id} — ${clausula.titulo}`}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && <EliminarClausulaButton clausulaId={clausula.id} />}
            {isAdmin && (
              <EditClausulaButton
                clausulaId={clausula.id}
                titulo={clausula.titulo}
                descripcion={clausula.descripcion ?? null}
              />
            )}
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/clausulas">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-3xl mx-auto w-full">

        {/* Puntos relacionados */}
        <div className="flex items-start gap-3">
          <p className="text-sm text-muted-foreground w-44 shrink-0 pt-0.5">Puntos relacionados</p>
          {isAdmin ? (
            <ClausulasRelacionadasEditor
              clausulaId={clausula.id}
              relacionadas={(clausula.relacionadas as string[]) ?? []}
            />
          ) : (
            <p className="text-sm">{((clausula.relacionadas as string[]) ?? []).join(", ") || "—"}</p>
          )}
        </div>

        {/* Estado general de la cláusula */}
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
          semaforo === "vigente"     ? "border-green-200 bg-green-50"  :
          semaforo === "por_vencer"  ? "border-yellow-200 bg-yellow-50" :
          "border-red-200 bg-red-50"
        }`}>
          {semaforo === "vigente"    && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
          {semaforo === "por_vencer" && <Clock        className="h-5 w-5 text-yellow-500 shrink-0" />}
          {(semaforo === "vencido" || semaforo === "sin_evidencia") && <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
          <div>
            <p className={`text-sm font-medium ${
              semaforo === "vigente"    ? "text-green-700"  :
              semaforo === "por_vencer" ? "text-yellow-700" :
              "text-red-700"
            }`}>
              {semaforo === "vigente"       && "Todo en orden — documentación vigente"}
              {semaforo === "por_vencer"    && "Hay documentos por vencer pronto"}
              {semaforo === "vencido"       && "Hay documentos vencidos o incompletos"}
              {semaforo === "sin_evidencia" && "Sin documentos — agregá al menos uno para esta cláusula"}
            </p>
            {clausula.descripcion && (
              <p className="text-xs text-muted-foreground mt-0.5">{clausula.descripcion}</p>
            )}
          </div>
        </div>

        {/* Lista de documentos */}
        {(items?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Documentos ({items!.length})
            </p>
            <div className="rounded-lg border divide-y">
              {items!.map((item) => {
                const itemMeta = (item.metadata ?? {}) as Record<string, unknown>;
                const doc  = (tieneDoc[item.id]  ?? false) || itemMeta.documento_na  === true;
                const proc = (tieneProc[item.id] ?? false) || itemMeta.procedimiento_na === true;
                const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
                const fv = item.fecha_vencimiento ? new Date(item.fecha_vencimiento + "T00:00:00") : null;
                const vencOk   = fv ? fv >= hoy : false;
                const vencWarn = vencOk && fv ? fv <= new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000) : false;
                const vencColor: "ok" | "warn" | "fail" = vencOk ? (vencWarn ? "warn" : "ok") : "fail";

                return (
                  <Link
                    key={item.id}
                    href={`/items/${item.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.titulo}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-muted-foreground">{item.codigo}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {TIPO_ITEM_LABELS[item.tipo as keyof typeof TIPO_ITEM_LABELS]}
                        </Badge>
                      </div>
                    </div>

                    {/* 3 semáforos */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      <SemaforoChip
                        icon={BookOpen}
                        label="Proc."
                        status={proc ? "ok" : "fail"}
                        title={proc ? "Procedimiento cargado" : "Falta procedimiento"}
                      />
                      <SemaforoChip
                        icon={FileText}
                        label="Doc."
                        status={doc ? "ok" : "fail"}
                        title={doc ? "Documento cargado" : "Falta documento"}
                      />
                      <SemaforoChip
                        icon={Calendar}
                        label={item.fecha_vencimiento ? formatFecha(item.fecha_vencimiento)! : "Sin fecha"}
                        status={vencColor}
                        title={
                          item.estado === "vigente"    ? `Vigente hasta ${formatFecha(item.fecha_vencimiento)}` :
                          item.estado === "por_vencer" ? `Vence pronto: ${formatFecha(item.fecha_vencimiento)}` :
                          item.fecha_vencimiento       ? `Venció: ${formatFecha(item.fecha_vencimiento)}` :
                          "Sin fecha de vencimiento"
                        }
                      />
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            No hay documentos para esta cláusula todavía.
          </div>
        )}

        {/* Agregar documento */}
        {isAdmin && <div className="flex justify-end pt-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/items/nuevo?clausula=${params.id}`}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar documento
            </Link>
          </Button>
        </div>}

      </div>
    </div>
  );
}

type SemaforoStatus = "ok" | "warn" | "fail";

function SemaforoChip({
  icon: Icon, label, status, title,
}: {
  icon: React.ElementType;
  label: string;
  status: SemaforoStatus;
  title: string;
}) {
  const colors: Record<SemaforoStatus, string> = {
    ok:   "bg-green-50  border-green-200  text-green-700",
    warn: "bg-yellow-50 border-yellow-200 text-yellow-700",
    fail: "bg-red-50    border-red-200    text-red-600",
  };
  const iconColors: Record<SemaforoStatus, string> = {
    ok:   "text-green-500",
    warn: "text-yellow-500",
    fail: "text-red-500",
  };
  return (
    <div
      title={title}
      className={`flex items-center gap-1 border rounded-md px-2 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      <Icon className={`h-3 w-3 shrink-0 ${iconColors[status]}`} />
      {label}
    </div>
  );
}
