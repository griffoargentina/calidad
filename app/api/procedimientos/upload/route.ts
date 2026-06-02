import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const procedimientoId = (formData.get("procedimiento_id") as string) || "general";

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `procedimientos/${procedimientoId}/${Date.now()}_${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/documentos/${path}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "3600",
    },
    body: arrayBuffer,
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `[Storage] ${body}` }, { status: 500 });
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/documentos/${path}`;
  return NextResponse.json({ url: publicUrl, nombre: file.name });
}
