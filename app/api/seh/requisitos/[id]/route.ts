import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();

  // Traer el requisito con datos del estado actual (último cumplimiento)
  const { data: requisito, error } = await admin
    .from("seh_requisitos")
    .select("*, ubicacion:seh_ubicaciones(*)")
    .eq("id", id)
    .single();

  if (error || !requisito) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Todos los cumplimientos con archivos
  const { data: cumplimientos } = await admin
    .from("seh_cumplimientos")
    .select("*, archivos:seh_archivos(*), responsable:usuarios!responsable_id(id, nombre)")
    .eq("requisito_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ ...requisito, cumplimientos: cumplimientos ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { nombre, norma, tipo_vencimiento, periodicidad_meses, aplica, observacion_general, activo } = body;

  const { data, error } = await admin
    .from("seh_requisitos")
    .update({
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(norma !== undefined && { norma: norma || null }),
      ...(tipo_vencimiento !== undefined && { tipo_vencimiento }),
      ...(periodicidad_meses !== undefined && { periodicidad_meses: periodicidad_meses || null }),
      ...(aplica !== undefined && { aplica }),
      ...(observacion_general !== undefined && { observacion_general: observacion_general || null }),
      ...(activo !== undefined && { activo }),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
