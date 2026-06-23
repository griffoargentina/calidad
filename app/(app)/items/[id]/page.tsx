import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RenovarModal } from "@/components/items/renovar-modal";
import { SubirProcedimientoModal } from "@/components/items/subir-procedimiento-modal";
import { InlineField } from "@/components/items/inline-field";
import { ProcNaToggle } from "@/components/items/proc-na-toggle";
import { DocNaToggle } from "@/components/items/doc-na-toggle";
import { ComentariosSection } from "@/components/items/comentarios-section";
import { EliminarItemButton } from "@/components/items/eliminar-item-button";
import { formatFecha, formatBytes } from "@/lib/utils/format";
import {
  FileText, Download, Tag, Calendar, Hash, ArrowLeft,
  BookOpen, CheckCircle2, XCircle, Building2, Layers, User, RefreshCw,
} from "lucide-react";
import Link from "next/link";

const FRECUENCIA_MAP: Record<number, string> = {
  30: "Mensual", 60: "Bimestral", 90: "Trimestral",
  180: "Semestral", 365: "Anual", 730: "Bienal",
};

function frecuenciaLabel(dias: number | null): string {
  if (!dias) return "Sin definir";
  return FRECUENCIA_MAP[dias] ?? `Cada ${dias} días`;
}

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: item }, { data: usuario }] = await Promise.all([
    supabase
      .from("items")
      .select(`*, clausulas_iso(id, titulo), areas(id, nombre), usuarios!responsable_id(id, nombre, email)`)
      .eq("id", params.id)
      .single(),
    supabase.from("usuarios").select("*").eq("id", user.id).single(),
  ]);

  if (!item) notFound();

  const { data: archivos } = await supabase
    .from("archivos")
    .select("*, subidor:usuarios!subido_por(nombre), aprobador:usuarios!aprobado_por(nombre)")
    .eq("item_id", params.id)
    .order("version", { ascending: false });

  const documentos    = archivos?.filter((a) => (a.categoria ?? "documento") === "documento") ?? [];
  const procedimientos = archivos?.filter((a) => a.categoria === "procedimiento") ?? [];

  const procNextVersion = (procedimientos[0]?.version ?? 0) + 1;
  const docNextVersion  = (documentos[0]?.version ?? 0) + 1;

  const canEdit = usuario?.rol === "admin" || (
    usuario?.rol === "editor" && (
      item.responsable_id === user.id ||
      item.area_id === usuario.area_id ||
      (usuario.tipos_habilitados as string[]).includes(item.tipo)
    )
  );

  const clausula   = item.clausulas_iso as { id: string; titulo: string } | null;
  const area       = item.areas as { nombre: string } | null;
  const responsable = item.usuarios as { id: string; nombre: string; email: string } | null;

  // Semáforos
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const docNa = meta.documento_na === true;

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const en30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Vencimiento documento
  const fechaVencDoc  = item.fecha_vencimiento ? new Date(item.fecha_vencimiento) : null;
  const docVencOk    = fechaVencDoc ? fechaVencDoc >= hoy : false;
  const docVencWarn  = fechaVencDoc ? fechaVencDoc >= hoy && fechaVencDoc <= en30 : false;

  // Vencimiento procedimiento
  const fechaVencProc = item.proc_fecha_vencimiento ? new Date(item.proc_fecha_vencimiento) : null;
  const procVencOk   = fechaVencProc ? fechaVencProc >= hoy : false;
  const procVencWarn = fechaVencProc ? fechaVencProc >= hoy && fechaVencProc <= en30 : false;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={item.titulo}
        actions={
          canEdit ? (
            <div className="flex items-center gap-2">
              {usuario?.rol === "admin" && (
                <EliminarItemButton itemId={params.id} titulo={item.titulo} />
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/items/${params.id}/editar`}>Editar</Link>
              </Button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-5">

        {/* Breadcrumb + códigos */}
        <div className="flex items-center justify-between">
          <Link href="/items" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Documentos
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-primary">{item.codigo}</span>
            <span className="text-xs text-muted-foreground font-mono">({item.codigo_completo})</span>
          </div>
        </div>

        {/* ── SEMÁFOROS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SemaforoCard
            label="Responsable"
            ok={!!responsable}
            okText={responsable?.nombre ?? ""}
            failText="Sin asignar"
            icon={User}
          />
          <SemaforoCard
            label="Venc. Procedimiento"
            ok={procVencOk}
            warn={procVencWarn}
            okText={item.proc_fecha_vencimiento ? (formatFecha(item.proc_fecha_vencimiento) ?? "") : ""}
            failText={item.proc_fecha_vencimiento ? `Venció ${formatFecha(item.proc_fecha_vencimiento)}` : "Sin fecha"}
            icon={BookOpen}
          />
          <SemaforoCard
            label="Venc. Documento"
            ok={docVencOk}
            warn={docVencWarn}
            okText={item.fecha_vencimiento ? (formatFecha(item.fecha_vencimiento) ?? "") : ""}
            failText={item.fecha_vencimiento ? `Venció ${formatFecha(item.fecha_vencimiento)}` : "Sin fecha"}
            icon={Calendar}
          />
          <SemaforoCard
            label="Área"
            ok={!!area}
            okText={area?.nombre ?? ""}
            failText="Sin área"
            icon={Building2}
          />
        </div>

        {/* ── INFO GENERAL INLINE ── */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm py-3 border-b border-t">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Hash className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">{clausula ? `${clausula.id} — ${clausula.titulo}` : "—"}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">{area?.nombre ?? "—"}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">{responsable?.nombre ?? "—"}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">{frecuenciaLabel(item.frecuencia_dias)}</span>
          </span>
          {item.descripcion && (
            <span className="flex items-center gap-1.5 text-muted-foreground w-full">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span className="italic">{item.descripcion}</span>
            </span>
          )}
          {item.etiquetas?.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {item.etiquetas.map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </span>
          )}
        </div>

        {/* ── DOS CARDS: PROCEDIMIENTO | DOCUMENTO ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* ── PROCEDIMIENTO ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-purple-500" />
                Procedimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm border-b pb-3">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Vencimiento
                </span>
                <InlineField
                  itemId={params.id}
                  field="proc_fecha_vencimiento"
                  value={item.proc_fecha_vencimiento ?? null}
                  displayValue={item.proc_fecha_vencimiento
                    ? new Date(item.proc_fecha_vencimiento + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "Sin fecha"}
                  type="date"
                  canEdit={canEdit}
                  emptyClass="text-muted-foreground"
                />
              </div>
              <div className="flex items-center justify-between text-sm border-b pb-3">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Frecuencia
                </span>
                <span className="font-medium text-sm">Anual</span>
              </div>

              {procedimientos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-3 border-2 border-dashed rounded-lg">
                  <BookOpen className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Sin procedimiento cargado</p>
                  {canEdit && (
                    <div className="w-full space-y-2 px-2">
                      <SubirProcedimientoModal item={item} nextVersion={procNextVersion} />
                      <ProcNaToggle itemId={params.id} value={meta.procedimiento_na === true} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <ul className="space-y-2">
                    {(procedimientos as Array<Record<string, unknown> & { id: string; nombre_archivo: string; tamaño_bytes: number | null; subido_at: string; archivo_url: string; version: number; codigo?: string | null; tipo_documento?: string | null }>).map((p) => (
                      <li key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-100">
                        <FileText className="h-5 w-5 text-purple-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {p.codigo && (
                              <span className="text-xs font-mono font-semibold text-blue-600">{p.codigo}</span>
                            )}
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 font-mono">Rev. {p.version}</Badge>
                          </div>
                          <p className="text-sm font-medium truncate">{p.nombre_archivo}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(p.tamaño_bytes)} · {formatFecha(p.subido_at)}</p>
                        </div>
                        <Button variant="ghost" size="icon" asChild>
                          <a href={`/api/download?url=${encodeURIComponent(p.archivo_url)}`} download={p.nombre_archivo}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {canEdit && (
                    <div className="pt-1">
                      <SubirProcedimientoModal item={item} nextVersion={procNextVersion} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── DOCUMENTO ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm border-b pb-3">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Vencimiento
                </span>
                <InlineField
                  itemId={params.id}
                  field="fecha_vencimiento"
                  value={item.fecha_vencimiento ?? null}
                  displayValue={item.fecha_vencimiento
                    ? new Date(item.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "Sin fecha"}
                  type="date"
                  canEdit={canEdit}
                  emptyClass="text-muted-foreground"
                />
              </div>
              <div className="flex items-center justify-between text-sm border-b pb-3">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Frecuencia
                </span>
                <InlineField
                  itemId={params.id}
                  field="frecuencia_dias"
                  value={item.frecuencia_dias?.toString() ?? null}
                  displayValue={frecuenciaLabel(item.frecuencia_dias)}
                  type="select"
                  options={[
                    { value: "30",  label: "Mensual" },
                    { value: "90",  label: "Trimestral" },
                    { value: "180", label: "Semestral" },
                    { value: "365", label: "Anual" },
                    { value: "730", label: "Bienal" },
                  ]}
                  canEdit={canEdit}
                  emptyClass="text-muted-foreground"
                />
              </div>

              {documentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-3 border-2 border-dashed rounded-lg">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Sin documento cargado</p>
                  {canEdit && (
                    <div className="w-full space-y-2 px-2">
                      <RenovarModal item={item} nextVersion={docNextVersion} />
                      <DocNaToggle itemId={params.id} value={docNa} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <ul className="space-y-2">
                    {(documentos as Array<Record<string, unknown> & { id: string; nombre_archivo: string; tamaño_bytes: number | null; subido_at: string; comentario: string | null; aprobado_at: string | null; version: number; archivo_url: string; subidor?: { nombre: string } | null; aprobador?: { nombre: string } | null; codigo?: string | null; tipo_documento?: string | null }>).map((archivo, idx) => (
                      <li key={archivo.id} className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <FileText className="h-5 w-5 text-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {archivo.codigo && (
                              <span className="text-xs font-mono font-semibold text-blue-600">{archivo.codigo}</span>
                            )}
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 font-mono">Rev. {archivo.version}</Badge>
                          </div>
                          <p className="text-sm font-medium truncate">{archivo.nombre_archivo}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(archivo.tamaño_bytes)} · {formatFecha(archivo.subido_at)}</p>
                          {archivo.comentario && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">{archivo.comentario}</p>
                          )}
                          {archivo.aprobado_at && (
                            <p className="text-xs text-green-600 mt-0.5">
                              Aprobado por {archivo.aprobador?.nombre} · {formatFecha(archivo.aprobado_at)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {idx === 0 && canEdit && (
                            <RenovarModal item={item} nextVersion={docNextVersion} />
                          )}
                          <Button variant="ghost" size="icon" asChild>
                            <a href={`/api/download?url=${encodeURIComponent(archivo.archivo_url)}`} download={archivo.nombre_archivo}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

{/* ── COMENTARIOS ── */}
        <ComentariosSection itemId={params.id} />

      </div>
    </div>
  );
}

function SemaforoCard({ label, ok, warn, okText, failText, icon: Icon }: {
  label: string;
  ok: boolean;
  warn?: boolean;
  okText: string;
  failText: string;
  icon: React.ElementType;
}) {
  const color = !ok ? "red" : warn ? "yellow" : "green";
  const bg   = color === "green" ? "bg-green-50 border-green-200" : color === "yellow" ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";
  const ico  = color === "green" ? "text-green-500" : color === "yellow" ? "text-yellow-500" : "text-red-500";
  const txt  = color === "green" ? "text-green-700" : color === "yellow" ? "text-yellow-700" : "text-red-700";
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${bg}`}>
      <Icon className={`h-5 w-5 shrink-0 ${ico}`} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          {ok && !warn && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
          {ok && warn  && <CheckCircle2 className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
          {!ok         && <XCircle      className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          <p className={`text-sm font-medium truncate ${txt}`}>
            {ok ? okText : failText}
          </p>
        </div>
      </div>
    </div>
  );
}
