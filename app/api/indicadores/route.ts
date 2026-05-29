import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

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
