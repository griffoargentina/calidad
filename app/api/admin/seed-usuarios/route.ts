import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const USUARIOS = [
  { email: "jagriffo@griffo.com.ar",     nombre: "Javier Griffo",    rol: "admin",  area: "Programación" },
  { email: "calidad@griffo.com.ar",       nombre: "Walter Riccelli",  rol: "editor", area: "Calidad" },
  { email: "produccion@griffo.com.ar",    nombre: "Sergio Rodriguez", rol: "editor", area: "Producción" },
  { email: "compras@griffo.com.ar",       nombre: "Gustavo Nardi",    rol: "editor", area: "Compras" },
  { email: "mantenimiento@griffo.com.ar", nombre: "José Machado",     rol: "editor", area: "Mantenimiento" },
];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const resultados: Record<string, string> = {};

  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authUsers = authData?.users ?? [];

  for (const u of USUARIOS) {
    // 1. Asegurar que existe en auth.users
    let authId = authUsers.find(au => au.email === u.email)?.id ?? null;
    if (!authId) {
      const { data: created, error: ce } = await admin.auth.admin.createUser({
        email: u.email, password: "GriffoQMS2025!", email_confirm: true,
      });
      if (ce || !created?.user) { resultados[u.email] = `error auth: ${ce?.message}`; continue; }
      authId = created.user.id;
    }

    // 2. Buscar área
    const { data: area } = await admin.from("areas").select("id").eq("nombre", u.area).single();
    const areaId = area?.id ?? null;

    // 3. Verificar si ya existe en public.usuarios (por id O por email)
    const { data: existente } = await admin.from("usuarios")
      .select("id").or(`id.eq.${authId},email.eq.${u.email}`).single();

    if (existente) {
      // Ya existe — update
      const { error: ue } = await admin.from("usuarios")
        .update({ nombre: u.nombre, rol: u.rol, area_id: areaId, email: u.email })
        .eq("id", existente.id);
      resultados[u.email] = ue ? `error update: ${ue.message}` : "actualizado";
    } else {
      // No existe — insert
      const { error: ie } = await admin.from("usuarios").insert({
        id: authId, email: u.email, nombre: u.nombre, rol: u.rol, area_id: areaId,
      });
      resultados[u.email] = ie ? `error insert: ${ie.message}` : "creado";
    }
  }

  const { count } = await admin.from("usuarios").select("id", { count: "exact", head: true });
  return NextResponse.json({ resultados, total_en_tabla: count });
}
