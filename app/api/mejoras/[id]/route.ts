import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function canEdit(userId: string, mejoraId: string, admin: ReturnType<typeof createAdminClient>) {
  const [{ data: usuario }, { data: mejora }] = await Promise.all([
    admin.from("usuarios").select("rol").eq("id", userId).single(),
    admin.from("mejoras").select("created_by").eq("id", mejoraId).single(),
  ]);
  if (!mejora) return false;
  if (usuario?.rol === "admin" || usuario?.rol === "editor") return true;
  return mejora.created_by === userId;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mejoras")
    .select("*, fotos:mejoras_fotos(*), creador:usuarios!mejoras_created_by_fkey(id, nombre)")
    .eq("id", params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  if (!(await canEdit(user.id, params.id, admin))) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const allowed = [
    "titulo", "sector", "maquina_equipo", "area_oportunidad",
    "situacion_antes", "situacion_despues", "accion_tomada",
    "causa_descripcion", "resultado_cambio", "responsable_nombre",
    "fecha_implementacion", "estado",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key] ?? null;
  }

  const { data, error } = await admin
    .from("mejoras")
    .update(patch)
    .eq("id", params.id)
    .select("*, fotos:mejoras_fotos(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  if (!(await canEdit(user.id, params.id, admin))) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Delete photos from storage first
  const { data: fotos } = await admin.from("mejoras_fotos").select("storage_path").eq("mejora_id", params.id);
  if (fotos?.length) {
    await admin.storage.from("mejoras-fotos").remove(fotos.map((f: { storage_path: string }) => f.storage_path));
  }

  const { error } = await admin.from("mejoras").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
