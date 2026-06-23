import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const childResults = await Promise.all([
    admin.from("archivos").delete().eq("item_id", params.id),
    admin.from("historial").delete().eq("item_id", params.id),
    admin.from("comentarios").delete().eq("item_id", params.id),
  ]);
  const childError = childResults.find((r) => r.error)?.error;
  if (childError) return NextResponse.json({ error: childError.message }, { status: 500 });

  const { error } = await admin.from("items").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
