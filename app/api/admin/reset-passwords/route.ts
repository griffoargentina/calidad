import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: caller } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (caller?.rol !== "admin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { password } = await req.json();
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Contraseña inválida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: usuarios } = await admin.from("usuarios").select("id").eq("activo", true);

  const results = await Promise.all(
    (usuarios ?? []).map((u) =>
      admin.auth.admin.updateUserById(u.id, { password })
        .then(({ error }) => ({ id: u.id, ok: !error, error: error?.message }))
    )
  );

  const ok = results.filter((r) => r.ok).length;
  const errors = results.filter((r) => !r.ok);

  return NextResponse.json({ ok, errors });
}
