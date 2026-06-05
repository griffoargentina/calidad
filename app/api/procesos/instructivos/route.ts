import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const sectorId = url.searchParams.get("sector_id");

  const admin = createAdminClient();
  let query = admin
    .from("proc_instructivos")
    .select("*, responsable:usuarios!responsable_id(id, nombre), sector:proc_sectores(id, nombre)")
    .order("nombre");

  if (sectorId) query = query.eq("sector_id", sectorId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { sector_id, nombre, responsable_id, url_archivo, nombre_archivo, es_publico, estado } = await req.json();
  if (!sector_id || !nombre?.trim()) {
    return NextResponse.json({ error: "sector_id y nombre son requeridos" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("proc_instructivos")
    .insert({
      sector_id,
      nombre: nombre.trim(),
      responsable_id: responsable_id || null,
      url_archivo: url_archivo || null,
      nombre_archivo: nombre_archivo || null,
      es_publico: es_publico ?? false,
      estado: estado ?? "borrador",
    })
    .select("*, responsable:usuarios!responsable_id(id, nombre)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
