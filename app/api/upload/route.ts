import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Verificar sesión
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file      = formData.get("file") as File | null;
  const itemId    = formData.get("item_id") as string;
  const categoria = (formData.get("categoria") as string) || "documento";
  const version   = parseInt(formData.get("version") as string) || 1;
  const comentario = formData.get("comentario") as string | null;

  if (!file || !itemId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const ext = file.name.split(".").pop();
  const timestamp = Date.now();
  const path = categoria === "procedimiento"
    ? `items/${itemId}/procedimiento_${timestamp}.${ext}`
    : `items/${itemId}/v${version}_${timestamp}.${ext}`;

  const admin = createAdminClient();

  // Subir a Storage usando admin (bypassa RLS)
  const { error: storageError } = await admin.storage
    .from("documentos")
    .upload(path, file, { upsert: true });

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from("documentos").getPublicUrl(path);

  // Insertar en archivos usando admin (bypassa RLS)
  const { error: dbError } = await admin.from("archivos").insert({
    item_id: itemId,
    version,
    archivo_url: publicUrl,
    nombre_archivo: file.name,
    tamaño_bytes: file.size,
    categoria,
    ...(comentario ? { comentario } : {}),
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl });
}
