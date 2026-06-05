import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; pasoId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const k of ["nombre", "tipo", "descripcion", "rama_si", "rama_no"]) {
    if (k in body) allowed[k] = body[k];
  }

  const { data: paso, error } = await admin
    .from("proc_pasos")
    .update(allowed)
    .eq("id", params.pasoId)
    .eq("flujograma_id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update sector links if provided
  if (Array.isArray(body.sectores)) {
    await admin.from("proc_paso_sectores").delete().eq("paso_id", params.pasoId);
    if (body.sectores.length > 0) {
      await admin.from("proc_paso_sectores").insert(
        body.sectores.map((sid: string) => ({ paso_id: params.pasoId, sector_id: sid }))
      );
    }
  }

  // Update linked instructivo if provided (null to clear, string to set)
  if ("instructivo_id" in body) {
    await admin.from("proc_paso_instructivos").delete().eq("paso_id", params.pasoId);
    if (body.instructivo_id) {
      await admin.from("proc_paso_instructivos").insert({
        paso_id: params.pasoId,
        instructivo_id: body.instructivo_id,
      });
    }
  }

  // Update flujograma timestamp
  await admin.from("proc_flujogramas").update({ updated_at: new Date().toISOString() }).eq("id", params.id);

  return NextResponse.json(paso);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; pasoId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { error } = await admin
    .from("proc_pasos")
    .delete()
    .eq("id", params.pasoId)
    .eq("flujograma_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Re-number remaining pasos sequentially after deletion
  const { data: remaining } = await admin
    .from("proc_pasos")
    .select("id")
    .eq("flujograma_id", params.id)
    .order("orden");

  if (remaining) {
    await Promise.all(
      remaining.map((p, idx) =>
        admin.from("proc_pasos").update({ orden: idx }).eq("id", p.id)
      )
    );
  }

  await admin.from("proc_flujogramas").update({ updated_at: new Date().toISOString() }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
