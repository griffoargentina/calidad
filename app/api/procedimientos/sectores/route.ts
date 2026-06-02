import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: sectores, error } = await admin
    .from("proc_sectores")
    .select("*")
    .eq("activo", true)
    .order("orden");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sectorIds = (sectores ?? []).map((s: { id: string }) => s.id);
  const { data: procedimientos } = await admin
    .from("proc_procedimientos")
    .select("id, sector_id")
    .in("sector_id", sectorIds.length ? sectorIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("activo", true);

  const procIds = (procedimientos ?? []).map((p: { id: string }) => p.id);
  const { data: revisiones } = await admin
    .from("proc_revisiones")
    .select("procedimiento_id, fecha_vencimiento")
    .in("procedimiento_id", procIds.length ? procIds : ["00000000-0000-0000-0000-000000000000"])
    .order("fecha_revision", { ascending: false });

  const latestRevMap: Record<string, string | null> = {};
  for (const rev of revisiones ?? []) {
    const r = rev as { procedimiento_id: string; fecha_vencimiento: string };
    if (!latestRevMap[r.procedimiento_id]) latestRevMap[r.procedimiento_id] = r.fecha_vencimiento;
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const en30 = new Date(hoy.getTime() + 30 * 86400000);

  const sectorStats: Record<string, { total: number; vencidos: number; porVencer: number }> = {};
  for (const proc of procedimientos ?? []) {
    const p = proc as { id: string; sector_id: string };
    if (!sectorStats[p.sector_id]) sectorStats[p.sector_id] = { total: 0, vencidos: 0, porVencer: 0 };
    const s = sectorStats[p.sector_id];
    s.total++;
    const fv = latestRevMap[p.id] ? new Date(latestRevMap[p.id]! + "T00:00:00") : null;
    if (!fv || fv < hoy) s.vencidos++;
    else if (fv <= en30) s.porVencer++;
  }

  const result = (sectores ?? []).map((s: { id: string }) => ({
    ...s,
    stats: sectorStats[s.id] ?? { total: 0, vencidos: 0, porVencer: 0 },
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, descripcion, orden } = await req.json();
  if (!nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const { data: maxOrden } = await admin
    .from("proc_sectores")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await admin
    .from("proc_sectores")
    .insert({ nombre, descripcion: descripcion || null, orden: orden ?? ((maxOrden?.orden ?? 0) + 1) })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, stats: { total: 0, vencidos: 0, porVencer: 0 } }, { status: 201 });
}
