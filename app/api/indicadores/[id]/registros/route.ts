import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function calcularCumple(
  valor: string,
  metaValor: string | null,
  metaCondicion: string | null
): boolean | null {
  const v = valor.trim().toLowerCase();
  if (!v || ["en proceso", "s/d"].includes(v)) return null;
  if (!metaValor || !metaCondicion) return null;

  if (metaCondicion === "igual") {
    return v === metaValor.trim().toLowerCase();
  }

  const num = parseFloat(valor.replace(",", "."));
  const meta = parseFloat(metaValor.replace(",", "."));
  if (isNaN(num) || isNaN(meta)) return null;

  if (metaCondicion === "mayor") return num > meta;
  if (metaCondicion === "menor") return num < meta;
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, rol")
    .eq("id", user.id)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario not found" }, { status: 401 });
  }

  const { data: indicador, error: indError } = await admin
    .from("indicadores")
    .select("id, responsable_id, meta_valor, meta_condicion, frecuencia")
    .eq("id", id)
    .single();

  if (indError || !indicador) {
    return NextResponse.json({ error: "Indicador not found" }, { status: 404 });
  }

  const isAdmin = usuario.rol === "admin";
  const isResponsable = indicador.responsable_id === user.id;

  if (!isAdmin && !isResponsable) {
    return NextResponse.json(
      { error: "Solo el responsable o un administrador puede cargar datos" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { anio, mes, valor, comentario } = body;

  if (!anio || !valor) {
    return NextResponse.json({ error: "anio y valor son requeridos" }, { status: 400 });
  }

  // For annual indicators mes is null (requires: ALTER TABLE indicador_registros ALTER COLUMN mes DROP NOT NULL)
  const mesFinal = indicador.frecuencia === "anual" ? null : (mes ?? null);

  const cumple = calcularCumple(
    String(valor),
    indicador.meta_valor,
    indicador.meta_condicion
  );

  const { data: registro, error: regError } = await admin
    .from("indicador_registros")
    .upsert(
      {
        indicador_id: id,
        anio: Number(anio),
        mes: mesFinal,
        valor: String(valor),
        cumple,
        comentario: comentario ?? null,
        cargado_por: user.id,
      },
      { onConflict: "indicador_id,anio,mes" }
    )
    .select()
    .single();

  if (regError) {
    return NextResponse.json({ error: regError.message }, { status: 500 });
  }

  return NextResponse.json(registro, { status: 200 });
}
