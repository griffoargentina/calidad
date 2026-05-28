import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { responsable_id, frecuencia_dias, procedimiento_na, documento_na, fecha_vencimiento } = body as {
    responsable_id?: string | null;
    frecuencia_dias?: number | null;
    procedimiento_na?: boolean;
    documento_na?: boolean;
    fecha_vencimiento?: string | null;
  };

  const admin = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("responsable_id"    in body) patch.responsable_id    = responsable_id;
  if ("frecuencia_dias"   in body) patch.frecuencia_dias   = frecuencia_dias;
  if ("fecha_vencimiento" in body) patch.fecha_vencimiento = fecha_vencimiento;

  if ("procedimiento_na" in body || "documento_na" in body) {
    const { data: current } = await admin.from("items").select("metadata").eq("id", params.id).single();
    const meta = { ...(current?.metadata as object ?? {}) };
    if ("procedimiento_na" in body) Object.assign(meta, { procedimiento_na });
    if ("documento_na" in body) Object.assign(meta, { documento_na });
    patch.metadata = meta;
  }

  const { error } = await admin.from("items").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
