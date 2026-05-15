import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file       = formData.get("file") as File | null;
  const itemId     = formData.get("item_id") as string;
  const version    = parseInt(formData.get("version") as string) || 1;
  const comentario = formData.get("comentario") as string | null;

  if (!file || !itemId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const ext = file.name.split(".").pop();
  const path = `items/${itemId}/v${version}_${Date.now()}.${ext}`;

  const admin = createAdminClient();

  const { error: storageError } = await admin.storage
    .from("documentos")
    .upload(path, file, { upsert: false });

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from("documentos").getPublicUrl(path);

  const { error: rpcError } = await admin.rpc("fn_renovar_item", {
    p_item_id: itemId,
    p_archivo_url: publicUrl,
    p_nombre_archivo: file.name,
    p_tamaño_bytes: file.size,
    p_comentario: comentario || null,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
