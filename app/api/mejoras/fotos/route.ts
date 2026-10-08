import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const mejoraId = form.get("mejora_id") as string | null;
  const tipo = form.get("tipo") as "antes" | "despues" | null;

  if (!file || !mejoraId || !tipo || !["antes", "despues"].includes(tipo)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  // Check mejora exists
  const admin = createAdminClient();
  const { data: mejora } = await admin.from("mejoras").select("id").eq("id", mejoraId).single();
  if (!mejora) return NextResponse.json({ error: "Mejora no encontrada" }, { status: 404 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${mejoraId}/${tipo}/${Date.now()}-${safeName}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadErr } = await admin.storage
    .from("mejoras-fotos")
    .upload(path, bytes, { contentType: file.type || `image/${ext}`, upsert: false });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("mejoras-fotos").getPublicUrl(path);

  const { data, error } = await admin
    .from("mejoras_fotos")
    .insert({
      mejora_id: mejoraId,
      tipo,
      storage_path: path,
      nombre_archivo: file.name,
      url: publicUrl,
      subido_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
