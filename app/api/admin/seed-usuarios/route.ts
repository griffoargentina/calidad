import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const USUARIOS = [
  { email: "jagriffo@griffo.com.ar",      nombre: "Javier Griffo",    rol: "admin",  area: "Programación" },
  { email: "calidad@griffo.com.ar",        nombre: "Walter Riccelli",  rol: "editor", area: "Calidad" },
  { email: "produccion@griffo.com.ar",     nombre: "Sergio Rodriguez", rol: "editor", area: "Producción" },
  { email: "compras@griffo.com.ar",        nombre: "Gustavo Nardi",    rol: "editor", area: "Compras" },
  { email: "mantenimiento@griffo.com.ar",  nombre: "José Machado",     rol: "editor", area: "Mantenimiento" },
];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: me } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (me?.rol !== "admin") return NextResponse.json({ error: "Solo admins" }, { status: 403 });

  const admin = createAdminClient();
  const resultados: Record<string, string> = {};

  for (const u of USUARIOS) {
    // Buscar en auth.users
    const { data: authUsers } = await admin.auth.admin.listUsers();
    const authUser = authUsers?.users?.find((au) => au.email === u.email);

    if (!authUser) {
      // Crear en auth si no existe
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: "GriffoQMS2025!",
        email_confirm: true,
      });
      if (createErr || !created?.user) { resultados[u.email] = `error auth: ${createErr?.message}`; continue; }

      // Buscar o crear área
      const { data: area } = await admin.from("areas").select("id").eq("nombre", u.area).single();
      const areaId = area?.id ?? null;

      const { error: insertErr } = await admin.from("usuarios").upsert({
        id: created.user.id,
        email: u.email,
        nombre: u.nombre,
        rol: u.rol,
        area_id: areaId,
      }, { onConflict: "id" });

      resultados[u.email] = insertErr ? `error insert: ${insertErr.message}` : "creado";
    } else {
      // Ya existe en auth, solo asegurar registro en public.usuarios
      const { data: area } = await admin.from("areas").select("id").eq("nombre", u.area).single();
      const areaId = area?.id ?? null;

      const { error: upsertErr } = await admin.from("usuarios").upsert({
        id: authUser.id,
        email: u.email,
        nombre: u.nombre,
        rol: u.rol,
        area_id: areaId,
      }, { onConflict: "id" });

      resultados[u.email] = upsertErr ? `error upsert: ${upsertErr.message}` : "ok";
    }
  }

  return NextResponse.json({ resultados });
}
