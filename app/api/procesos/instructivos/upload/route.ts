import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { uploadArchivo } from "@/lib/server/upload-archivos";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol === "lector") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const formData     = await req.formData();
  const file         = formData.get("file") as File | null;
  const instructivoId = (formData.get("instructivo_id") as string) || crypto.randomUUID();
  const tipoDoc      = formData.get("tipo_documento") as string | null;
  const codigoManual = (formData.get("codigo_manual") as string | null) || null;
  const comentario   = formData.get("comentario") as string | null;

  if (!file) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });

  try {
    const result = await uploadArchivo({
      file, modulo: "instructivos", referenciaId: instructivoId,
      categoria: "documento", tipoDoc, codigoManual, comentario, userId: user.id,
    });
    return NextResponse.json({ url: result.url, nombre_archivo: file.name, codigo: result.codigo });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
