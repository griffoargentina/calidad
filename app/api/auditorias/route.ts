import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auditorias")
    .select(`
      id, titulo, tipo, norma, fecha_programada, fecha_vencimiento, frecuencia_dias, estado,
      nc_mayores, nc_menores, observaciones_count, archivo_url, archivo_nombre,
      notas, completada_at, created_at,
      areas(id, nombre),
      responsable:usuarios!responsable_id(id, nombre)
    `)
    .order("fecha_vencimiento", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const result = (data ?? []).map((a) => {
    const fv = a.fecha_vencimiento ? new Date(a.fecha_vencimiento + "T00:00:00") : null;
    let estado = a.estado;
    if (estado !== "completada" && fv && fv < hoy) estado = "vencida";
    return { ...a, estado };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol === "lector") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { titulo, tipo, area_id, responsable_id, norma, fecha_programada, fecha_vencimiento, frecuencia_dias, notas } = body;

  if (!titulo?.trim() || !fecha_vencimiento) {
    return NextResponse.json({ error: "Título y fecha de vencimiento son requeridos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auditorias")
    .insert({
      titulo: titulo.trim(),
      tipo: tipo ?? "interna",
      area_id: area_id || null,
      responsable_id: responsable_id || null,
      norma: norma || "ISO 9001:2015",
      fecha_programada: fecha_programada || null,
      fecha_vencimiento,
      frecuencia_dias: frecuencia_dias || null,
      notas: notas || null,
      estado: "programada",
      creado_por: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
