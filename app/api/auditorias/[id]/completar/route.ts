import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol === "lector") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { nc_mayores = 0, nc_menores = 0, observaciones_count = 0, archivo_url, archivo_nombre, notas } = body;

  const admin = createAdminClient();
  const { data: auditoria, error: fetchError } = await admin
    .from("auditorias")
    .select("*")
    .eq("id", params.id)
    .single();

  if (fetchError || !auditoria) {
    return NextResponse.json({ error: "Auditoría no encontrada" }, { status: 404 });
  }

  const ahora = new Date().toISOString();

  const { error: updateError } = await admin
    .from("auditorias")
    .update({
      estado: "completada",
      nc_mayores,
      nc_menores,
      observaciones_count,
      archivo_url: archivo_url || null,
      archivo_nombre: archivo_nombre || null,
      notas: notas != null ? notas : auditoria.notas,
      completada_at: ahora,
      updated_at: ahora,
    })
    .eq("id", params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Register file in auditoria_archivos if provided
  if (archivo_url && archivo_nombre) {
    await admin.from("auditoria_archivos").insert({
      auditoria_id: params.id,
      nombre: archivo_nombre,
      url: archivo_url,
      notas: "Informe de auditoría (completar)",
      subido_por: user.id,
    }).select().single();
  }

  let nextAuditoria = null;
  if (auditoria.frecuencia_dias) {
    const hoy = new Date(ahora);
    hoy.setHours(0, 0, 0, 0);
    const proxVenc = new Date(hoy);
    proxVenc.setDate(proxVenc.getDate() + auditoria.frecuencia_dias);

    const { data: next } = await admin
      .from("auditorias")
      .insert({
        titulo: auditoria.titulo,
        tipo: auditoria.tipo,
        area_id: auditoria.area_id,
        responsable_id: auditoria.responsable_id,
        norma: auditoria.norma,
        fecha_programada: hoy.toISOString().split("T")[0],
        fecha_vencimiento: proxVenc.toISOString().split("T")[0],
        frecuencia_dias: auditoria.frecuencia_dias,
        estado: "programada",
        creado_por: user.id,
      })
      .select()
      .single();

    nextAuditoria = next;
  }

  return NextResponse.json({ ok: true, nextAuditoria });
}
