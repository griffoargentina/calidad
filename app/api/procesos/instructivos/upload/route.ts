import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol === "lector") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });

  const uid = crypto.randomUUID();
  const path = `instructivos/${uid}/${file.name}`;

  const arrayBuffer = await file.arrayBuffer();
  const storageRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documentos/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "3600",
    },
    body: arrayBuffer,
  });

  if (!storageRes.ok) {
    const body = await storageRes.text();
    return NextResponse.json({ error: body }, { status: 500 });
  }

  return NextResponse.json({
    url: `${SUPABASE_URL}/storage/v1/object/public/documentos/${path}`,
    nombre_archivo: file.name,
  });
}
