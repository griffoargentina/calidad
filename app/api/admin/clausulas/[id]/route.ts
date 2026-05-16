import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") return NextResponse.json({ error: "Solo admins" }, { status: 403 });

  const admin = createAdminClient();
  const force = new URL(req.url).searchParams.get("force") === "true";

  const { count } = await admin.from("items").select("id", { count: "exact", head: true }).eq("clausula_iso", params.id);

  if ((count ?? 0) > 0 && !force) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${count} documento(s) asociado(s)` },
      { status: 409 }
    );
  }

  if ((count ?? 0) > 0 && force) {
    const { error: itemsErr } = await admin.from("items").delete().eq("clausula_iso", params.id);
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  const { error } = await admin.from("clausulas_iso").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
