import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { uploadArchivo } from "@/lib/server/upload-archivos";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol === "lector") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const formData = await req.formData();
  const file      = formData.get("file") as File | null;
  const auditoriaId = formData.get("auditoriaId") as string | null;
  const tipoDoc   = formData.get("tipo_documento") as string | null;
  const categoria = (formData.get("categoria") as string) || "informe";

  if (!file || !auditoriaId) {
    return NextResponse.json({ error: "Archivo e ID requeridos" }, { status: 400 });
  }

  try {
    const result = await uploadArchivo({
      file, modulo: "auditorias", referenciaId: auditoriaId,
      categoria, tipoDoc, userId: user.id,
    });
    return NextResponse.json({ url: result.url, nombre: file.name, codigo: result.codigo });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
