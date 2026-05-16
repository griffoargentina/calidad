import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();

  // Actualizar items con estado pendiente_aprobacion o borrador → vigente
  const { count, error } = await admin
    .from("items")
    .update({ estado: "vigente", es_borrador: false, requiere_aprobacion: false })
    .in("estado", ["pendiente_aprobacion", "borrador"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, actualizados: count });
}
