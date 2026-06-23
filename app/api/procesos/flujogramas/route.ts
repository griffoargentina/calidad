import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { generarCodigo } from "@/lib/procesos/generar-codigo";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { sector_id, nombre, descripcion, tipo_doc_id } = await req.json();
  if (!sector_id || !nombre?.trim()) {
    return NextResponse.json({ error: "sector_id y nombre son requeridos" }, { status: 400 });
  }

  let codigo: string | null = null;
  if (tipo_doc_id) {
    const { data: tipDoc } = await admin
      .from("proc_tipos_documento")
      .select("prefijo")
      .eq("id", tipo_doc_id)
      .single();
    if (tipDoc?.prefijo) {
      codigo = await generarCodigo(sector_id, tipDoc.prefijo);
    }
  }

  const { data, error } = await admin
    .from("proc_flujogramas")
    .insert({
      sector_id,
      nombre: nombre.trim(),
      descripcion: descripcion || null,
      creado_por: user.id,
      tipo_doc_id: tipo_doc_id || null,
      codigo,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
