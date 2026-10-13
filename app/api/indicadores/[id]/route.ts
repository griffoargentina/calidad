import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Fetch indicador with responsable
  const { data: indicador, error } = await supabase
    .from("indicadores")
    .select(`
      *,
      responsable:usuarios!responsable_id (
        id,
        nombre,
        email
      )
    `)
    .eq("id", id)
    .single();

  if (error || !indicador) {
    return NextResponse.json({ error: "Indicador not found" }, { status: 404 });
  }

  // Fetch ALL registros for this indicador
  const { data: registros, error: regError } = await supabase
    .from("indicador_registros")
    .select(`
      *,
      cargado_por_usuario:usuarios!cargado_por (
        id,
        nombre
      )
    `)
    .eq("indicador_id", id)
    .order("anio", { ascending: false })
    .order("mes", { ascending: false, nullsFirst: false });

  if (regError) {
    return NextResponse.json({ error: regError.message }, { status: 500 });
  }

  return NextResponse.json({
    ...indicador,
    registros: registros ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador puede editar la meta" }, { status: 403 });
  }

  const body = await request.json();
  const { meta_valor, meta_condicion, meta_unidad } = body;

  // 1. Actualizar la meta del indicador
  const { data, error } = await admin
    .from("indicadores")
    .update({ meta_valor: meta_valor ?? null, meta_condicion: meta_condicion ?? null, meta_unidad: meta_unidad ?? null })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Recalcular cumple en todos los registros existentes con la nueva meta
  if (meta_valor && meta_condicion) {
    const { data: registros } = await admin
      .from("indicador_registros")
      .select("id, valor")
      .eq("indicador_id", id);

    for (const reg of registros ?? []) {
      const r = reg as { id: string; valor: string };
      const v = r.valor.trim().toLowerCase();
      let cumple: boolean | null = null;

      if (v && !["en proceso", "s/d"].includes(v)) {
        if (meta_condicion === "igual") {
          cumple = v === String(meta_valor).trim().toLowerCase();
        } else {
          const num = parseFloat(r.valor.replace(",", "."));
          const meta = parseFloat(String(meta_valor).replace(",", "."));
          if (!isNaN(num) && !isNaN(meta)) {
            if (meta_condicion === "mayor") cumple = num > meta;
            else if (meta_condicion === "menor") cumple = num < meta;
          }
        }
      }

      await admin.from("indicador_registros").update({ cumple }).eq("id", r.id);
    }
  }

  return NextResponse.json(data);
}
