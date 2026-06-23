import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const aplicaA = url.searchParams.get("aplica_a"); // 'instructivo' | 'flujograma'

  const admin = createAdminClient();
  let query = admin
    .from("proc_tipos_documento")
    .select("*")
    .eq("activo", true)
    .order("orden");

  if (aplicaA) {
    query = query.contains("aplica_a", [aplicaA]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
