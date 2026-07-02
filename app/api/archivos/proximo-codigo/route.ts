import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const prefijo = url.searchParams.get("prefijo");
  if (!prefijo) return NextResponse.json({ error: "Falta prefijo" }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("archivos")
    .select("codigo")
    .like("codigo", `${prefijo}-%`);

  const max = (data ?? []).reduce((acc: number, row: { codigo: string | null }) => {
    const n = parseInt((row.codigo ?? "").split("-")[1] ?? "0");
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);

  const proximo = max + 1;
  return NextResponse.json({
    proximo,
    codigo: `${prefijo}-${String(proximo).padStart(2, "0")}`,
  });
}
