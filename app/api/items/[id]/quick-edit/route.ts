import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { responsable_id, frecuencia_dias, procedimiento_na } = body as {
    responsable_id?: string | null;
    frecuencia_dias?: number | null;
    procedimiento_na?: boolean;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("responsable_id"   in body) patch.responsable_id   = responsable_id;
  if ("frecuencia_dias"  in body) patch.frecuencia_dias  = frecuencia_dias;
  if ("procedimiento_na" in body) patch.procedimiento_na = procedimiento_na;

  const admin = createAdminClient();
  const { error } = await admin.from("items").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
