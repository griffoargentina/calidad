import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const CLAUSULAS = [
  {
    id: "5.2.2",
    titulo: "Comunicación de la política de la calidad",
    descripcion: "La política de la calidad debe estar disponible y mantenerse como información documentada, comunicarse, entenderse y aplicarse dentro de la organización, y estar disponible para las partes interesadas pertinentes.",
  },
  {
    id: "10.1",
    titulo: "Mejora — Generalidades",
    descripcion: "La organización debe determinar y seleccionar las oportunidades de mejora e implementar cualquier acción necesaria para cumplir los requisitos del cliente y aumentar la satisfacción del cliente.",
  },
];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: me } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (me?.rol !== "admin") return NextResponse.json({ error: "Solo admins" }, { status: 403 });

  const admin = createAdminClient();
  const resultados: Record<string, string> = {};

  for (const c of CLAUSULAS) {
    const { error } = await admin.from("clausulas_iso").upsert(c, { onConflict: "id" });
    resultados[c.id] = error ? `ERROR: ${error.message}` : "ok";
  }

  return NextResponse.json({ resultados });
}
