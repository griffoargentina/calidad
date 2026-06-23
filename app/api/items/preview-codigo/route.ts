import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const prefijo = new URL(req.url).searchParams.get("prefijo");
  if (!prefijo) return NextResponse.json({ error: "prefijo requerido" }, { status: 400 });

  const { data } = await supabase
    .from("items")
    .select("codigo")
    .like("codigo", `${prefijo}-%`);

  const max = (data ?? []).reduce((acc, row) => {
    const n = parseInt((row.codigo ?? "").split("-")[1] ?? "0");
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);

  const siguiente = `${prefijo}-${String(max + 1).padStart(2, "0")}`;
  return NextResponse.json({ codigo: siguiente });
}
