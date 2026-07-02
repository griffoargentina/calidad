import { createAdminClient } from "@/lib/supabase/admin";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function uploadToStorage(path: string, file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/documentos/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "3600",
    },
    body: arrayBuffer,
  });
  if (!res.ok) throw new Error(await res.text());
  return `${SUPABASE_URL}/storage/v1/object/public/documentos/${path}`;
}

interface UploadParams {
  file: File;
  modulo: string;          // 'items' | 'instructivos' | 'flujogramas' | 'calibracion' | 'auditorias'
  referenciaId: string;    // ID del registro padre
  categoria?: string;      // 'documento' | 'procedimiento' | 'certificado' | etc.
  tipoDoc?: string | null;
  codigoManual?: string | null; // si el usuario eligió un código específico (ej: "PR-05")
  comentario?: string | null;
  userId: string;
  itemId?: string | null;  // solo para modulo='items'
}

export async function uploadArchivo(params: UploadParams) {
  const { file, modulo, referenciaId, categoria = "documento", tipoDoc, codigoManual, comentario, userId, itemId } = params;
  const admin = createAdminClient();

  // Versión correlativa por referencia + modulo + categoria
  const { data: existing } = await admin
    .from("archivos")
    .select("version")
    .eq("referencia_id", referenciaId)
    .eq("modulo", modulo)
    .eq("categoria", categoria)
    .order("version", { ascending: false })
    .limit(1);
  const version = existing?.[0] ? existing[0].version + 1 : 1;

  // Código global único por tipo
  let codigoArchivo: string | null = null;
  if (codigoManual) {
    // Validar que el código manual no exista ya
    const { data: existe } = await admin
      .from("archivos")
      .select("id")
      .eq("codigo", codigoManual)
      .limit(1);
    if (existe && existe.length > 0) {
      throw new Error(`El código ${codigoManual} ya está en uso. Elegí otro número.`);
    }
    codigoArchivo = codigoManual;
  } else if (tipoDoc) {
    // Auto-generar: max + 1 global por prefijo
    const { data: codigosExistentes } = await admin
      .from("archivos")
      .select("codigo")
      .like("codigo", `${tipoDoc}-%`);
    const max = (codigosExistentes ?? []).reduce((acc: number, row: { codigo: string | null }) => {
      const n = parseInt((row.codigo ?? "").split("-")[1] ?? "0");
      return isNaN(n) ? acc : Math.max(acc, n);
    }, 0);
    codigoArchivo = `${tipoDoc}-${String(max + 1).padStart(2, "0")}`;
  }

  // Ruta de storage
  const ext = file.name.split(".").pop();
  const ts = Date.now();
  const storagePath =
    modulo === "items"
      ? categoria === "procedimiento"
        ? `items/${referenciaId}/procedimiento_v${version}_${ts}.${ext}`
        : `items/${referenciaId}/v${version}_${ts}.${ext}`
      : `${modulo}/${referenciaId}/v${version}_${ts}.${ext}`;

  const publicUrl = await uploadToStorage(storagePath, file);

  const { error: dbError } = await admin.from("archivos").insert({
    item_id:        modulo === "items" ? (itemId ?? referenciaId) : null,
    modulo,
    referencia_id:  referenciaId,
    version,
    archivo_url:    publicUrl,
    nombre_archivo: file.name,
    tamaño_bytes:   file.size,
    categoria,
    subido_por:     userId,
    ...(comentario    ? { comentario }              : {}),
    ...(tipoDoc       ? { tipo_documento: tipoDoc } : {}),
    ...(codigoArchivo ? { codigo: codigoArchivo }   : {}),
  });

  if (dbError) throw new Error(`[DB] ${dbError.message}`);

  // Sincronizar version_actual en items
  if (modulo === "items") {
    await admin
      .from("items")
      .update({ version_actual: version })
      .eq("id", itemId ?? referenciaId)
      .lt("version_actual", version);
  }

  return { url: publicUrl, codigo: codigoArchivo, version };
}
