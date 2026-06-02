import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { ProcedimientosGrid } from "@/components/procedimientos/procedimientos-grid";

export const dynamic = "force-dynamic";

export default async function ProcedimientosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [{ data: sectores }, { data: usuarioData }] = await Promise.all([
    admin.from("proc_sectores").select("*").eq("activo", true).order("orden"),
    admin.from("usuarios").select("rol").eq("id", user.id).single(),
  ]);

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

  const sectoresConStats = (sectores ?? []).map((s: { id: string }) => ({
    ...s,
    stats: sectorStats[s.id] ?? { total: 0, vencidos: 0, porVencer: 0 },
  }));

  const isAdmin = usuarioData?.rol === "admin";

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Procedimientos" />
      <ProcedimientosGrid sectores={sectoresConStats} isAdmin={isAdmin} />
    </div>
  );
}
