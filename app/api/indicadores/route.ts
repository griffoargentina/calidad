import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  const body = await request.json();
  if (!body.nombre?.trim() || !body.sector?.trim()) {
    return NextResponse.json({ error: "nombre y sector son requeridos" }, { status: 400 });
  }

  const { data: maxOrden } = await admin.from("indicadores").select("orden").order("orden", { ascending: false }).limit(1).single();
  const orden = (maxOrden?.orden ?? 0) + 1;

  const { data, error } = await admin.from("indicadores").insert({
    nombre: body.nombre.trim(),
    sector: body.sector.trim(),
    objetivo_estrategico: body.objetivo_estrategico?.trim() ?? "",
    formula: body.formula?.trim() || null,
    frecuencia: body.frecuencia ?? "mensual",
    meta_valor: body.meta_valor?.trim() || null,
    meta_condicion: body.meta_condicion || null,
    meta_unidad: body.meta_unidad?.trim() || null,
    responsable_id: body.responsable_id || null,
    orden,
    activo: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const currentYear = new Date().getFullYear();

  // Fetch all active indicadores ordered by orden, with responsable
  const { data: indicadores, error } = await supabase
    .from("indicadores")
    .select(`
      *,
      responsable:usuarios!responsable_id (
        id,
        nombre,
        email
      )
    `)
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!indicadores || indicadores.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch all registros for current year
  const indicadorIds = indicadores.map((i) => i.id);
  const { data: registros, error: regError } = await supabase
    .from("indicador_registros")
    .select("*")
    .in("indicador_id", indicadorIds)
    .eq("anio", currentYear)
    .order("mes", { ascending: true });

  if (regError) {
    return NextResponse.json({ error: regError.message }, { status: 500 });
  }

  // Group registros by indicador_id
  const registrosByIndicador: Record<string, typeof registros> = {};
  for (const reg of registros ?? []) {
    if (!registrosByIndicador[reg.indicador_id]) {
      registrosByIndicador[reg.indicador_id] = [];
    }
    registrosByIndicador[reg.indicador_id]!.push(reg);
  }

  // Nest registros into indicadores
  const result = indicadores.map((ind) => ({
    ...ind,
    registros: registrosByIndicador[ind.id] ?? [],
  }));

  return NextResponse.json(result);
}
