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
  const tipoDoc          = formData.get("tipo_documento") as string | null;

  if (!file || !itemId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Sync version_actual with MAX(archivos.version WHERE categoria='documento')
  // fn_renovar_item uses version_actual+1 for the new documento version.
  const { data: latestDoc } = await admin
    .from("archivos")
    .select("version")
    .eq("item_id", itemId)
    .eq("categoria", "documento")
    .order("version", { ascending: false })
    .limit(1);

  const currentDocVersion = latestDoc?.[0]?.version ?? 0;
  await admin
    .from("items")
    .update({ version_actual: currentDocVersion })
    .eq("id", itemId);

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

    // Actualizar el archivo recién insertado con tipo_documento y codigo generado
    if (tipoDoc) {
      const { data: codigosExistentes } = await admin
        .from("archivos")
        .select("codigo")
        .like("codigo", `${tipoDoc}-%`);
      const max = (codigosExistentes ?? []).reduce((acc: number, row: { codigo: string | null }) => {
        const n = parseInt((row.codigo ?? "").split("-")[1] ?? "0");
        return isNaN(n) ? acc : Math.max(acc, n);
      }, 0);
      const codigoArchivo = `${tipoDoc}-${String(max + 1).padStart(2, "0")}`;

      // Obtener el archivo más reciente del item
      const { data: latestFile } = await admin
        .from("archivos")
        .select("id")
        .eq("item_id", itemId)
        .order("version", { ascending: false })
        .limit(1);

      if (latestFile?.[0]) {
        await admin
          .from("archivos")
          .update({ tipo_documento: tipoDoc, codigo: codigoArchivo })
          .eq("id", latestFile[0].id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: `[Storage] ${err instanceof Error ? err.message : "Error"}` }, { status: 500 });
  }
}
