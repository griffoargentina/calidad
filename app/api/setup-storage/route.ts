import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: us } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (us?.rol !== "admin") return NextResponse.json({ error: "Solo admins" }, { status: 403 });

  const admin = createAdminClient();

  const { data: buckets } = await admin.storage.listBuckets();
  const existe = buckets?.some((b) => b.name === "documentos");

  if (existe) return NextResponse.json({ ok: true, mensaje: "Bucket ya existe" });

  const { error } = await admin.storage.createBucket("documentos", { public: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, mensaje: "Bucket 'documentos' creado correctamente" });
}
