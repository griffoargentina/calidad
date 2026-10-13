import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/topbar";
import { SehFicha } from "@/components/seh/seh-ficha";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SehFichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const [{ data: requisito }, { data: usuarioData }] = await Promise.all([
    admin
      .from("seh_requisitos")
      .select("*, ubicacion:seh_ubicaciones(*)")
      .eq("id", id)
      .single(),
    admin.from("usuarios").select("rol, id").eq("id", user?.id ?? "").single(),
  ]);

  if (!requisito) notFound();

  const { data: cumplimientos } = await admin
    .from("seh_cumplimientos")
    .select("*, archivos:seh_archivos(*), responsable:usuarios!responsable_id(id, nombre)")
    .eq("requisito_id", id)
    .order("created_at", { ascending: false });

  const canEdit = usuarioData?.rol === "admin" || usuarioData?.rol === "editor";

  return (
    <div className="flex flex-col h-full">
      <Topbar title={requisito.nombre} />
      <div className="flex-1 p-6 overflow-auto">
        <SehFicha
          requisito={requisito}
          cumplimientosIniciales={cumplimientos ?? []}
          canEdit={canEdit}
          userId={user?.id ?? ""}
        />
      </div>
    </div>
  );
}
