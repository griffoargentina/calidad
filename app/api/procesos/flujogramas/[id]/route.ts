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

  const [{ data: flujograma }, { data: pasos }] = await Promise.all([
    admin.from("proc_flujogramas")
      .select("*, sector:proc_sectores(id, nombre)")
      .eq("id", params.id)
      .single(),
    admin.from("proc_pasos")
      .select("*, paso_sectores:proc_paso_sectores(sector_id, sector:proc_sectores(id, nombre)), paso_instructivo:proc_paso_instructivos(instructivo_id, instructivo:proc_instructivos(id, nombre, version, estado))")
      .eq("flujograma_id", params.id)
      .order("orden"),
  ]);

  if (!flujograma) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Normalize join results (Supabase may return object or array)
  const pasosNormalizados = (pasos ?? []).map((p) => ({
    ...p,
    sectores: (Array.isArray(p.paso_sectores) ? p.paso_sectores : [p.paso_sectores])
      .filter(Boolean)
      .map((ps: { sector_id: string; sector: { id: string; nombre: string } | { id: string; nombre: string }[] | null }) => {
        const sec = Array.isArray(ps.sector) ? ps.sector[0] : ps.sector;
        return sec;
      })
      .filter(Boolean),
    instructivo: (() => {
      const pi = Array.isArray(p.paso_instructivo) ? p.paso_instructivo[0] : p.paso_instructivo;
      if (!pi) return null;
      const inst = Array.isArray(pi.instructivo) ? pi.instructivo[0] : pi.instructivo;
      return inst ?? null;
    })(),
    paso_sectores: undefined,
    paso_instructivo: undefined,
  }));

  return NextResponse.json({ ...flujograma, pasos: pasosNormalizados });
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
  for (const k of ["nombre", "descripcion", "estado"]) {
    if (k in body) allowed[k] = body[k];
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from("proc_flujogramas")
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

  const { error } = await admin.from("proc_flujogramas").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
