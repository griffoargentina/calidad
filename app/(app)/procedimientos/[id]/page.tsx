import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { SectorProcedimientos } from "@/components/procedimientos/sector-procedimientos";

export const dynamic = "force-dynamic";

export default async function SectorPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [{ data: sector }, { data: usuarioData }, { data: usuarios }] = await Promise.all([
    admin.from("proc_sectores").select("*").eq("id", params.id).single(),
    admin.from("usuarios").select("rol").eq("id", user.id).single(),
    admin.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  if (!sector) notFound();

  const { data: procedimientos } = await admin
    .from("proc_procedimientos")
    .select(`*, responsable:usuarios!responsable_id(id, nombre)`)
    .eq("sector_id", params.id)
    .eq("activo", true)
    .order("nombre");

  const procIds = (procedimientos ?? []).map((p: { id: string }) => p.id);

  const { data: revisiones } = await admin
    .from("proc_revisiones")
    .select("*")
    .in("procedimiento_id", procIds.length ? procIds : ["00000000-0000-0000-0000-000000000000"])
    .order("version", { ascending: false });

  const latestRevMap: Record<string, unknown> = {};
  for (const rev of revisiones ?? []) {
    const r = rev as { procedimiento_id: string };
    if (!latestRevMap[r.procedimiento_id]) latestRevMap[r.procedimiento_id] = rev;
  }

  const procedimientosConRev = (procedimientos ?? []).map((p: { id: string }) => ({
    ...p,
    ultima_revision: latestRevMap[p.id] ?? null,
  }));

  const canEdit = ["admin", "editor"].includes(usuarioData?.rol ?? "");

  return (
    <div className="flex flex-col h-full">
      <Topbar title={`Procedimientos — ${(sector as { nombre: string }).nombre}`} />
      <SectorProcedimientos
        sector={sector as { id: string; nombre: string }}
        procedimientosIniciales={procedimientosConRev}
        usuarios={usuarios ?? []}
        canEdit={canEdit}
      />
    </div>
  );
}
