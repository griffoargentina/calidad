import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  // Verificar que el llamador es admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: caller } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (caller?.rol !== "admin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { email, nombre, rol, area_id } = body;

  if (!email || !nombre || !rol) {
    return NextResponse.json({ error: "Email, nombre y rol son obligatorios" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Invitar usuario por email (Supabase envía el email de invitación)
  const { data: invitado, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre },
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  // Insertar en tabla usuarios
  const { error: insertError } = await admin.from("usuarios").insert({
    id: invitado.user.id,
    email,
    nombre,
    rol,
    area_id: area_id || null,
    activo: true,
  });

  if (insertError) {
    // Si falla el insert, eliminar el usuario de auth para no dejar huérfanos
    await admin.auth.admin.deleteUser(invitado.user.id);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
