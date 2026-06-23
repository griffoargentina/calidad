import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: caller } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (caller?.rol !== "admin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { data: usuarios, error: listError } = await admin.from("usuarios").select("id, nombre");
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const resultados: { nombre: string; ok: boolean; error?: string }[] = [];

  for (const u of usuarios ?? []) {
    const { error } = await admin.auth.admin.updateUserById(u.id, { password: "123456" });
    resultados.push({ nombre: u.nombre, ok: !error, error: error?.message });
  }

  return NextResponse.json({ resultados, total: resultados.length });
}
