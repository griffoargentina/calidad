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
  const file             = formData.get("file") as File | null;
  const itemId           = formData.get("item_id") as string;
  const comentario       = formData.get("comentario") as string | null;
  const fechaVencimiento = formData.get("fecha_vencimiento") as string | null;

  if (!file || !itemId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Sync version_actual with MAX(archivos.version) before calling fn_renovar_item.
  // fn_renovar_item uses version_actual+1 — if it's stale (e.g. a procedure was uploaded
  // after the last renewal), the insert would violate the unique constraint.
  const { data: latestArchivo } = await admin
    .from("archivos")
    .select("version")
    .eq("item_id", itemId)
    .order("version", { ascending: false })
    .limit(1);

  if (latestArchivo?.[0]) {
    await admin
      .from("items")
      .update({ version_actual: latestArchivo[0].version })
      .eq("id", itemId)
      .lt("version_actual", latestArchivo[0].version);
  }

  const ext = file.name.split(".").pop();
  const path = `items/${itemId}/v${Date.now()}.${ext}`;

  try {
    const publicUrl = await uploadToStorage(path, file);

    const { error: rpcError } = await admin.rpc("fn_renovar_item", {
      p_item_id: itemId,
      p_archivo_url: publicUrl,
      p_nombre_archivo: file.name,
      p_tamaño_bytes: file.size,
      p_comentario: comentario || null,
    });

    if (rpcError) return NextResponse.json({ error: `[RPC] ${rpcError.message}` }, { status: 500 });

    if (fechaVencimiento) {
      const { error: updateError } = await admin
        .from("items")
        .update({ fecha_vencimiento: fechaVencimiento })
        .eq("id", itemId);
      if (updateError) return NextResponse.json({ error: `[FECHA] ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: `[Storage] ${err instanceof Error ? err.message : "Error"}` }, { status: 500 });
  }
}
