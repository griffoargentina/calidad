import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usr } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (usr?.rol !== "admin") return NextResponse.json({ error: "Solo admins" }, { status: 403 });

  const admin = createAdminClient();
  const log: string[] = [];

  // 1. Asegurar que exista cláusula 6.3
  const { error: e1 } = await admin.from("clausulas_iso").upsert(
    { id: "6.3", titulo: "Planificación de cambios", relacionadas: ["10.3"] },
    { onConflict: "id" }
  );
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  log.push("Cláusula 6.3 upserted con relacionadas: [10.3]");

  // 2. Asegurar que exista cláusula 10.3
  const { error: e2 } = await admin.from("clausulas_iso").upsert(
    { id: "10.3", titulo: "Mejora continua", relacionadas: ["6.3"] },
    { onConflict: "id" }
  );
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  log.push("Cláusula 10.3 upserted con relacionadas: [6.3]");

  // 3. Crear el ítem si no existe
  const { data: existing } = await admin
    .from("items")
    .select("id")
    .eq("clausula_iso", "6.3")
    .eq("tipo", "formulario")
    .maybeSingle();

  if (existing) {
    log.push("El ítem ya existe, no se creó uno nuevo");
  } else {
    // Buscar el próximo código FOR-XXX
    const { data: ultimoFor } = await admin
      .from("items")
      .select("codigo")
      .like("codigo", "FOR-%")
      .order("codigo", { ascending: false })
      .limit(1);

    let siguiente = 1;
    if (ultimoFor?.[0]?.codigo) {
      const n = parseInt(ultimoFor[0].codigo.split("-")[1] ?? "0");
      if (!isNaN(n)) siguiente = n + 1;
    }
    const codigo = `FOR-${String(siguiente).padStart(3, "0")}`;

    const { error: e3 } = await admin.from("items").insert({
      codigo,
      codigo_completo: codigo,
      tipo: "formulario",
      clausula_iso: "6.3",
      titulo: "Plan de Cambios y Mejora Continua",
      estado: "vigente",
      es_borrador: false,
      requiere_aprobacion: false,
      version_actual: 1,
      etiquetas: ["cambios", "mejora continua"],
    });

    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
    log.push(`Ítem creado: ${codigo} — Plan de Cambios y Mejora Continua`);
  }

  return NextResponse.json({ ok: true, log });
}
