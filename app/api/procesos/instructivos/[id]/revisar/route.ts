import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { hubo_cambio, observaciones, url_archivo, nombre_archivo } = await req.json();

  const { data: instructivo } = await admin
    .from("proc_instructivos")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!instructivo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const ahora = new Date().toISOString();

  // Always log the revision
  await admin.from("proc_revisiones").insert({
    instructivo_id: params.id,
    revisado_por: user.id,
    fecha: ahora,
    hubo_cambio: hubo_cambio ?? false,
    url_archivo: url_archivo || null,
    nombre_archivo: nombre_archivo || null,
    observaciones: observaciones || null,
  });

  if (hubo_cambio) {
    // Update in-place: new file goes directly to vigente, no approval step needed
    const newEstado = url_archivo ? "vigente" : instructivo.estado;
    await admin.from("proc_instructivos").update({
      version: instructivo.version + 1,
      estado: newEstado,
      url_archivo: url_archivo || instructivo.url_archivo,
      nombre_archivo: nombre_archivo || instructivo.nombre_archivo,
      ultima_revision: ahora,
      updated_at: ahora,
    }).eq("id", params.id);
  } else {
    // No change: just update ultima_revision
    await admin.from("proc_instructivos").update({
      ultima_revision: ahora,
      updated_at: ahora,
    }).eq("id", params.id);
  }

  return NextResponse.json({ ok: true });
}
