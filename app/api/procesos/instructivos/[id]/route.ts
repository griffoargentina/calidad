import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const [
    { data: instructivo },
    { data: revisiones },
    { data: aprobaciones },
  ] = await Promise.all([
    admin.from("proc_instructivos")
      .select("*, responsable:usuarios!responsable_id(id, nombre), aprobador:usuarios!aprobado_por(id, nombre), sector:proc_sectores(id, nombre)")
      .eq("id", params.id)
      .single(),
    admin.from("proc_revisiones")
      .select("*, revisado_por_user:usuarios!revisado_por(id, nombre)")
      .eq("instructivo_id", params.id)
      .order("fecha", { ascending: false }),
    admin.from("proc_aprobaciones")
      .select("*, aprobador:usuarios!aprobado_por(id, nombre)")
      .eq("instructivo_id", params.id)
      .order("fecha", { ascending: false }),
  ]);

  if (!instructivo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ ...instructivo, revisiones: revisiones ?? [], aprobaciones: aprobaciones ?? [] });
}

export async function PATCH(
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

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const k of ["nombre", "responsable_id", "es_publico", "url_archivo", "nombre_archivo", "ultima_revision", "proxima_revision"]) {
    if (k in body) allowed[k] = body[k];
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from("proc_instructivos")
    .update(allowed)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { error } = await admin.from("proc_instructivos").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
