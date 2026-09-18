import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/topbar";
import { SehDashboard } from "@/components/seh/seh-dashboard";

export const dynamic = "force-dynamic";

export default async function SehPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const [
    { data: requisitos },
    { data: ubicaciones },
    { data: usuarioData },
  ] = await Promise.all([
    admin
      .from("seh_v_estado")
      .select("*")
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true }),
    admin.from("seh_ubicaciones").select("*").eq("activo", true).order("nombre"),
    admin.from("usuarios").select("rol").eq("id", user?.id ?? "").single(),
  ]);

  const canEdit = usuarioData?.rol === "admin" || usuarioData?.rol === "editor";

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Seguridad e Higiene" />
      <div className="flex-1 p-6 overflow-auto">
        <SehDashboard
          requisitosIniciales={requisitos ?? []}
          ubicaciones={ubicaciones ?? []}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
