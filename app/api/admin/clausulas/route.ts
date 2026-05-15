import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { id, titulo, descripcion } = body as { id: string; titulo: string; descripcion?: string };

  if (!id?.trim() || !titulo?.trim()) {
    return NextResponse.json({ error: "ID y título son obligatorios" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("clausulas_iso").insert({ id: id.trim(), titulo: titulo.trim(), descripcion: descripcion ?? null });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `Ya existe una cláusula con ID "${id}"` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
