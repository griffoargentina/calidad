import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/topbar";
import { MejorasDashboard } from "@/components/mejoras/mejoras-dashboard";

export const dynamic = "force-dynamic";

export default async function MejorasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const [{ data: mejoras }, { data: usuarioData }, { data: areasData }] = await Promise.all([
    admin
      .from("mejoras")
      .select("*, fotos:mejoras_fotos(*), creador:usuarios!mejoras_created_by_fkey(id, nombre)")
      .order("created_at", { ascending: false }),
    admin.from("usuarios").select("rol, nombre, area:areas(nombre)").eq("id", user?.id ?? "").single(),
    admin.from("areas").select("nombre").eq("activa", true).order("nombre"),
  ]);

  const canEditAll = usuarioData?.rol === "admin" || usuarioData?.rol === "editor";
  const userSector = (usuarioData?.area as unknown as { nombre: string } | null)?.nombre ?? null;
  const sectores = (areasData ?? []).map((a) => a.nombre);

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Mejora Continua" />
      <div className="flex-1 p-6 overflow-auto">
        <MejorasDashboard
          mejorasIniciales={mejoras ?? []}
          userId={user?.id ?? ""}
          canEditAll={canEditAll}
          userName={usuarioData?.nombre ?? ""}
          userSector={userSector}
          sectores={sectores}
        />
      </div>
    </div>
  );
}
