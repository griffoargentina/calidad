import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEMP_PASSWORD = "GriffoQMS2025!";

const AREAS_NUEVAS = ["Programación", "Calidad", "Producción", "Compras", "Mantenimiento"];

const USUARIOS = [
  { nombre: "Javier Griffo",    email: "jagriffo@griffo.com.ar",     area: "Programación" },
  { nombre: "Walter Riccelli",  email: "calidad@griffo.com.ar",      area: "Calidad"      },
  { nombre: "Sergio Rodriguez", email: "produccion@griffo.com.ar",   area: "Producción"   },
  { nombre: "Gustavo Nardi",    email: "compras@griffo.com.ar",      area: "Compras"      },
  { nombre: "José Machado",     email: "mantenimiento@griffo.com.ar", area: "Mantenimiento" },
];

export async function GET() {
  // Solo admins
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: u } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (u?.rol !== "admin") return NextResponse.json({ error: "Solo admins" }, { status: 403 });

  const admin = createAdminClient();

  // 1. Crear áreas que no existan
  const { data: areasExistentes } = await admin.from("areas").select("id, nombre");
  const areaMap: Record<string, string> = {};
  for (const a of areasExistentes ?? []) areaMap[a.nombre] = a.id;

  for (const nombre of AREAS_NUEVAS) {
    if (!areaMap[nombre]) {
      const { data: nueva } = await admin.from("areas").insert({ nombre, activa: true }).select("id").single();
      if (nueva) areaMap[nombre] = nueva.id;
    }
  }

  // 2. Crear usuarios auth + public.usuarios
  const resultados: Array<{ email: string; status: string }> = [];

  for (const u of USUARIOS) {
    // Crear en auth.users vía Admin API
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: u.email,
        password: TEMP_PASSWORD,
        email_confirm: true,
      }),
    });

    const authUser = await res.json();

    if (!res.ok) {
      resultados.push({ email: u.email, status: `error_auth: ${authUser.msg ?? JSON.stringify(authUser)}` });
      continue;
    }

    // Insertar en public.usuarios
    const { error: dbErr } = await admin.from("usuarios").upsert({
      id: authUser.id,
      email: u.email,
      nombre: u.nombre,
      rol: "editor",
      area_id: areaMap[u.area] ?? null,
      activo: true,
      tipos_habilitados: [],
    }, { onConflict: "id" });

    resultados.push({ email: u.email, status: dbErr ? `error_db: ${dbErr.message}` : "ok" });
  }

  return NextResponse.json({ resultados, areaMap });
}
