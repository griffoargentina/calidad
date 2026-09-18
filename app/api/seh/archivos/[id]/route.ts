import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: NextRequest,
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

  const { data: archivo } = await admin
    .from("seh_archivos")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (!archivo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await admin.storage.from("seh-archivos").remove([archivo.storage_path]);

  const { error } = await admin.from("seh_archivos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
