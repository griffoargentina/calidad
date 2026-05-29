import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();

  const { data: equipos, error } = await admin
    .from("equipos_calibracion")
    .select(`
      *,
      procedimiento:procedimientos_calibracion(id, titulo, archivo_url)
    `)
    .order("nombre");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get latest calibracion per equipo
  const equipoIds = (equipos ?? []).map((e: { id: string }) => e.id);
  const calibracionesMap: Record<string, unknown> = {};

  if (equipoIds.length > 0) {
    const { data: calibraciones } = await admin
      .from("calibraciones")
      .select("*")
      .in("equipo_id", equipoIds)
      .order("fecha_calibracion", { ascending: false });

    for (const c of calibraciones ?? []) {
      const cal = c as { equipo_id: string };
      if (!calibracionesMap[cal.equipo_id]) {
        calibracionesMap[cal.equipo_id] = c;
      }
    }
  }

  const result = (equipos ?? []).map((e: { id: string }) => ({
    ...e,
    ultima_calibracion: calibracionesMap[e.id] ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const {
    nombre, codigo, rango_max, identificacion_serie, tipo,
    procedimiento_id, lugar_uso, frecuencia, activo,
  } = body;

  if (!nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const { data, error } = await admin
    .from("equipos_calibracion")
    .insert({
      nombre,
      codigo,
      rango_max,
      identificacion_serie,
      tipo,
      procedimiento_id: procedimiento_id || null,
      lugar_uso,
      frecuencia,
      activo: activo ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
