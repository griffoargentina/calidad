import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const auditoriaId = formData.get("auditoriaId") as string | null;

  if (!file || !auditoriaId) {
    return NextResponse.json({ error: "Archivo e ID requeridos" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${auditoriaId}/${Date.now()}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("auditorias")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("auditorias").getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, nombre: file.name });
}
