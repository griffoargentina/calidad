import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/seh/archivos — upload a file to storage and register it
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || usuario.rol === "lector") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const cumplimiento_id = formData.get("cumplimiento_id") as string | null;

  if (!file || !cumplimiento_id) {
    return NextResponse.json({ error: "file y cumplimiento_id son requeridos" }, { status: 400 });
  }

  const ext = file.name.split(".").pop();
  const storagePath = `seh/${cumplimiento_id}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await admin.storage
    .from("seh-archivos")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: archivo, error: dbError } = await admin
    .from("seh_archivos")
    .insert({
      cumplimiento_id,
      nombre_archivo: file.name,
      storage_path: storagePath,
      subido_por: user.id,
    })
    .select()
    .single();

  if (dbError) {
    // Try to clean up storage on DB failure
    await admin.storage.from("seh-archivos").remove([storagePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Generate signed URL (1 hour)
  const { data: signed } = await admin.storage
    .from("seh-archivos")
    .createSignedUrl(storagePath, 3600);

  void ext; // used indirectly via storagePath
  return NextResponse.json({ ...archivo, url: signed?.signedUrl ?? null }, { status: 201 });
}
