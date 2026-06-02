import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("proc_revisiones")
    .select(`*, revisado_por_user:usuarios!revisado_por(nombre)`)
    .eq("procedimiento_id", params.id)
    .order("version", { ascending: false });

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

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { fecha_revision, fecha_vencimiento, archivo_url, archivo_nombre, observaciones } = body;

  if (!fecha_revision || !fecha_vencimiento) {
    return NextResponse.json({ error: "Fechas requeridas" }, { status: 400 });
  }

  const { data: lastRev } = await admin
    .from("proc_revisiones")
    .select("version")
    .eq("procedimiento_id", params.id)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const version = (lastRev?.version ?? 0) + 1;

  const { data, error } = await admin
    .from("proc_revisiones")
    .insert({
      procedimiento_id: params.id,
      version,
      fecha_revision,
      fecha_vencimiento,
      archivo_url: archivo_url || null,
      archivo_nombre: archivo_nombre || null,
      observaciones: observaciones || null,
      revisado_por: user.id,
    })
    .select(`*, revisado_por_user:usuarios!revisado_por(nombre)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
