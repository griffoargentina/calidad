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

  const sectorIds = (sectores ?? []).map((s) => s.id);

  const { data: procedimientos } = await admin
    .from("proc_procedimientos")
    .select("id, sector_id")
    .in("sector_id", sectorIds.length ? sectorIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("activo", true);

  const procIds = (procedimientos ?? []).map((p) => p.id);

  const { data: revisiones } = await admin
    .from("proc_revisiones")
    .select("procedimiento_id, fecha_vencimiento")
    .in("procedimiento_id", procIds.length ? procIds : ["00000000-0000-0000-0000-000000000000"])
    .order("fecha_revision", { ascending: false });

  const latestRevMap: Record<string, string | null> = {};
  for (const rev of revisiones ?? []) {
    if (!latestRevMap[rev.procedimiento_id]) latestRevMap[rev.procedimiento_id] = rev.fecha_vencimiento;
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const en30 = new Date(hoy.getTime() + 30 * 86400000);

  const sectorStats: Record<string, { total: number; vencidos: number; porVencer: number }> = {};
  for (const proc of procedimientos ?? []) {
    if (!sectorStats[proc.sector_id]) sectorStats[proc.sector_id] = { total: 0, vencidos: 0, porVencer: 0 };
    const s = sectorStats[proc.sector_id];
    s.total++;
    const fv = latestRevMap[proc.id] ? new Date(latestRevMap[proc.id]! + "T00:00:00") : null;
    if (!fv || fv < hoy) s.vencidos++;
    else if (fv <= en30) s.porVencer++;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectoresConStats = (sectores ?? []).map((s: any) => ({
    ...s,
    stats: sectorStats[s.id] ?? { total: 0, vencidos: 0, porVencer: 0 },
  }));

  const isAdmin = usuarioData?.rol === "admin";

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Procedimientos" />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ProcedimientosGrid sectores={sectoresConStats as any} isAdmin={isAdmin} />
    </div>
  );
}
