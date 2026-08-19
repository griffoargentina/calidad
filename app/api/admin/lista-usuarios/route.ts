import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("usuarios")
    .select("nombre, email, rol, activo")
    .order("nombre");
  return NextResponse.json(data ?? []);
}
