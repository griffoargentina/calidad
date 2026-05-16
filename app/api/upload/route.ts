import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function uploadToStorage(path: string, file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const url = `${SUPABASE_URL}/storage/v1/object/documentos/${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "3600",
    },
    body: arrayBuffer,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/documentos/${path}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file      = formData.get("file") as File | null;
  const itemId    = formData.get("item_id") as string;
  const categoria = (formData.get("categoria") as string) || "documento";
  const comentario = formData.get("comentario") as string | null;

  if (!file || !itemId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Versión global por item (el constraint UNIQUE es item_id+version sin categoría)
  const { data: existing } = await admin
    .from("archivos")
    .select("version")
    .eq("item_id", itemId)
    .order("version", { ascending: false })
    .limit(1);
  const version = existing?.[0] ? existing[0].version + 1 : 1;

  const ext = file.name.split(".").pop();
  const path = categoria === "procedimiento"
    ? `items/${itemId}/procedimiento_v${version}_${Date.now()}.${ext}`
    : `items/${itemId}/v${version}_${Date.now()}.${ext}`;

  try {
    const publicUrl = await uploadToStorage(path, file);

    const { error: dbError } = await admin.from("archivos").insert({
      item_id: itemId,
      version,
      archivo_url: publicUrl,
      nombre_archivo: file.name,
      tamaño_bytes: file.size,
      categoria,
      ...(comentario ? { comentario } : {}),
    });

    if (dbError) return NextResponse.json({ error: `[DB] ${dbError.message}` }, { status: 500 });

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    return NextResponse.json({ error: `[Storage] ${err instanceof Error ? err.message : "Error"}` }, { status: 500 });
  }
}
