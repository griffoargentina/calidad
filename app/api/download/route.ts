import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const archivoUrl = searchParams.get("url");
  if (!archivoUrl) return NextResponse.json({ error: "Falta url" }, { status: 400 });

  // Extraer el path dentro del bucket desde la URL almacenada
  // Formato: https://[project].supabase.co/storage/v1/object/public/documentos/items/...
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/documentos/`;
  const prefixAlt = `${SUPABASE_URL}/storage/v1/object/documentos/`;
  const filePath = archivoUrl.startsWith(prefix)
    ? archivoUrl.slice(prefix.length)
    : archivoUrl.startsWith(prefixAlt)
    ? archivoUrl.slice(prefixAlt.length)
    : null;

  if (!filePath) return NextResponse.redirect(archivoUrl);

  // Generar URL firmada válida por 5 minutos
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("documentos")
    .createSignedUrl(filePath, 300);

  if (error || !data?.signedUrl) {
    // Fallback: intentar URL pública directa
    return NextResponse.redirect(archivoUrl);
  }

  return NextResponse.redirect(data.signedUrl);
}
