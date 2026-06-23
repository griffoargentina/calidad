import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol === "lector") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const admin = createAdminClient();

  // Allowlist editable fields — prevents callers from overwriting creado_por, completada_at, etc.
  const allowed = ["titulo", "tipo", "area_id", "responsable_id", "norma",
    "fecha_programada", "fecha_vencimiento", "frecuencia_dias", "estado", "notas"];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const { data, error } = await admin
    .from("auditorias")
    .update(patch)
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

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol !== "admin") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  const admin = createAdminClient();
  const { error } = await admin.from("auditorias").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
