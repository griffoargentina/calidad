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
  const [{ data: sector }, { data: responsables }, { data: flujogramas }, { data: instructivos }] = await Promise.all([
    admin.from("proc_sectores").select("*").eq("id", params.id).single(),
    admin.from("proc_sector_responsables").select("usuario_id, usuarios(id, nombre)").eq("sector_id", params.id),
    admin.from("proc_flujogramas").select("id, nombre, version, estado, created_at, updated_at").eq("sector_id", params.id).order("created_at"),
    admin.from("proc_instructivos").select("id, nombre, version, estado, responsable_id, ultima_revision, proxima_revision, es_publico, url_archivo, nombre_archivo").eq("sector_id", params.id).order("nombre"),
  ]);

  if (!sector) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({
    ...sector,
    responsables: (responsables ?? []).map((r) => {
      const usuarios = r.usuarios;
      if (Array.isArray(usuarios)) return usuarios[0] ?? null;
      return usuarios;
    }).filter(Boolean),
    flujogramas: flujogramas ?? [],
    instructivos: instructivos ?? [],
  });
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
  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const k of ["nombre", "descripcion", "privado", "orden", "activo"]) {
    if (k in body) allowed[k] = body[k];
  }

  const { data, error } = await admin
    .from("proc_sectores")
    .update(allowed)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update responsables if provided
  if (Array.isArray(body.responsables)) {
    await admin.from("proc_sector_responsables").delete().eq("sector_id", params.id);
    if (body.responsables.length > 0) {
      await admin.from("proc_sector_responsables").insert(
        body.responsables.map((uid: string) => ({ sector_id: params.id, usuario_id: uid }))
      );
    }
  }

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

  const { error } = await admin
    .from("proc_sectores")
    .update({ activo: false })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
