import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  const body = await request.json();
  const allowed = ["nombre", "sector", "objetivo_estrategico", "formula", "frecuencia", "meta_valor", "meta_condicion", "meta_unidad", "responsable_id", "orden", "activo"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  const { data, error } = await admin.from("indicadores").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Fetch indicador with responsable
  const { data: indicador, error } = await supabase
    .from("indicadores")
    .select(`
      *,
      responsable:usuarios!responsable_id (
        id,
        nombre,
        email
      )
    `)
    .eq("id", id)
    .single();

  if (error || !indicador) {
    return NextResponse.json({ error: "Indicador not found" }, { status: 404 });
  }

  // Fetch ALL registros for this indicador
  const { data: registros, error: regError } = await supabase
    .from("indicador_registros")
    .select(`
      *,
      cargado_por_usuario:usuarios!cargado_por (
        id,
        nombre
      )
    `)
    .eq("indicador_id", id)
    .order("anio", { ascending: false })
    .order("mes", { ascending: false, nullsFirst: false });

  if (regError) {
    return NextResponse.json({ error: regError.message }, { status: 500 });
  }

  return NextResponse.json({
    ...indicador,
    registros: registros ?? [],
  });
}
