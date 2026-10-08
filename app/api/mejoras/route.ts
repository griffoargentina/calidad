import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mejoras")
    .select("*, fotos:mejoras_fotos(*), creador:usuarios!mejoras_created_by_fkey(id, nombre)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    titulo, sector, maquina_equipo, area_oportunidad,
    situacion_antes, situacion_despues, accion_tomada,
    causa_descripcion, resultado_cambio, responsable_nombre,
    fecha_implementacion, estado,
  } = body;

  if (!titulo?.trim() || !sector?.trim()) {
    return NextResponse.json({ error: "Título y sector son requeridos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mejoras")
    .insert({
      numero: "",
      titulo: titulo.trim(),
      sector: sector.trim(),
      maquina_equipo: maquina_equipo || null,
      area_oportunidad: area_oportunidad || null,
      situacion_antes: situacion_antes || null,
      situacion_despues: situacion_despues || null,
      accion_tomada: accion_tomada || null,
      causa_descripcion: causa_descripcion || null,
      resultado_cambio: resultado_cambio || null,
      responsable_nombre: responsable_nombre || null,
      fecha_implementacion: fecha_implementacion || null,
      estado: estado || "en_ejecucion",
      created_by: user.id,
    })
    .select("*, fotos:mejoras_fotos(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
