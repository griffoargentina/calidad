import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { uploadArchivo } from "@/lib/server/upload-archivos";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol === "lector") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const formData  = await req.formData();
  const file      = formData.get("file") as File | null;
  const itemId    = formData.get("item_id") as string | null;
  const modulo    = (formData.get("modulo") as string) || "items";
  const refId     = (formData.get("referencia_id") as string) || itemId;
  const categoria = (formData.get("categoria") as string) || "documento";
  const comentario = formData.get("comentario") as string | null;
  const tipoDoc   = formData.get("tipo_documento") as string | null;

  if (!file || !refId) {
    return NextResponse.json({ error: "Faltan file y referencia_id (o item_id)" }, { status: 400 });
  }

  try {
    const result = await uploadArchivo({
      file, modulo, referenciaId: refId, categoria,
      tipoDoc, comentario, userId: user.id, itemId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
