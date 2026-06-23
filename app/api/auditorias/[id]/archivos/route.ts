import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auditoria_archivos")
    .select(`
      id, nombre, url, notas, created_at,
      subido_por:usuarios!subido_por(nombre)
    `)
    .eq("auditoria_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol === "lector") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { nombre, url, notas } = body;

  if (!nombre || !url) {
    return NextResponse.json({ error: "Nombre y URL requeridos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auditoria_archivos")
    .insert({
      auditoria_id: params.id,
      nombre,
      url,
      notas: notas || null,
      subido_por: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol === "lector") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const url = new URL(req.url);
  const archivoId = url.searchParams.get("archivoId");
  if (!archivoId) return NextResponse.json({ error: "archivoId requerido" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("auditoria_archivos")
    .delete()
    .eq("id", archivoId)
    .eq("auditoria_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
