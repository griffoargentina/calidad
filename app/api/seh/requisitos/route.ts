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
    .from("seh_v_estado")
    .select("*")
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const {
    nombre, ambito, ubicacion_id, norma, tipo_vencimiento,
    periodicidad_meses, aplica, observacion_general,
    // cumplimiento inicial
    fecha_vencimiento, fecha_planificada, observacion,
  } = body;

  if (!nombre?.trim() || !ambito || !ubicacion_id) {
    return NextResponse.json({ error: "Nombre, ámbito y ubicación son requeridos" }, { status: 400 });
  }

  // Crear requisito
  const { data: requisito, error: reqErr } = await admin
    .from("seh_requisitos")
    .insert({
      nombre: nombre.trim(),
      ambito,
      ubicacion_id,
      norma: norma || null,
      tipo_vencimiento: tipo_vencimiento || "fecha_fija",
      periodicidad_meses: periodicidad_meses || null,
      aplica: aplica ?? true,
      observacion_general: observacion_general || null,
    })
    .select()
    .single();

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

  // Crear cumplimiento inicial
  const { data: cumplimiento, error: cumErr } = await admin
    .from("seh_cumplimientos")
    .insert({
      requisito_id: requisito.id,
      fecha_vencimiento: fecha_vencimiento || null,
      fecha_planificada: fecha_planificada || null,
      observacion: observacion || null,
      responsable_id: user.id,
    })
    .select()
    .single();

  if (cumErr) return NextResponse.json({ error: cumErr.message }, { status: 500 });

  return NextResponse.json({ requisito, cumplimiento }, { status: 201 });
}
