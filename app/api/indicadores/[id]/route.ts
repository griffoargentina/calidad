import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
