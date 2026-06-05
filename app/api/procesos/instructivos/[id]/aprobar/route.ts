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
  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json({ error: "Solo admins pueden aprobar instructivos" }, { status: 403 });
  }

  const { aprobar, observaciones } = await req.json();

  const { data: instructivo } = await admin
    .from("proc_instructivos")
    .select("id, version, estado")
    .eq("id", params.id)
    .single();

  if (!instructivo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (aprobar) {
    // Archive any previous vigente version of same nombre+sector
    const { data: prev } = await admin
      .from("proc_instructivos")
      .select("id, nombre, sector_id")
      .eq("id", params.id)
      .single();

    if (prev) {
      await admin
        .from("proc_instructivos")
        .update({ estado: "historico" })
        .eq("sector_id", prev.sector_id)
        .eq("nombre", prev.nombre)
        .eq("estado", "vigente");
    }

    const ahora = new Date().toISOString();
    await admin.from("proc_instructivos").update({
      estado: "vigente",
      aprobado_por: user.id,
      aprobado_at: ahora,
      observaciones_rechazo: null,
      updated_at: ahora,
    }).eq("id", params.id);

    await admin.from("proc_aprobaciones").insert({
      instructivo_id: params.id,
      version: instructivo.version,
      aprobado_por: user.id,
      estado: "aprobado",
      observaciones: observaciones || null,
    });
  } else {
    const ahora = new Date().toISOString();
    await admin.from("proc_instructivos").update({
      estado: "rechazado",
      observaciones_rechazo: observaciones || null,
      updated_at: ahora,
    }).eq("id", params.id);

    await admin.from("proc_aprobaciones").insert({
      instructivo_id: params.id,
      version: instructivo.version,
      aprobado_por: user.id,
      estado: "rechazado",
      observaciones: observaciones || null,
    });
  }

  const { data: updated } = await admin.from("proc_instructivos").select("*").eq("id", params.id).single();
  return NextResponse.json(updated);
}
