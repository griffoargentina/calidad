import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: foto } = await admin
    .from("mejoras_fotos")
    .select("*, mejora:mejoras(created_by)")
    .eq("id", params.id)
    .single();

  if (!foto) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  // Check permission: uploader, mejora owner, or admin/editor
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  const isAdmin = usuario?.rol === "admin" || usuario?.rol === "editor";
  const isOwner = foto.subido_by === user.id || (foto.mejora as { created_by: string } | null)?.created_by === user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  await admin.storage.from("mejoras-fotos").remove([foto.storage_path]);

  const { error } = await admin.from("mejoras_fotos").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
