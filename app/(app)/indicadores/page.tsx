import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { IndicadoresDashboard } from "@/components/indicadores/indicadores-dashboard";
import { Usuario } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function IndicadoresPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await admin.from("usuarios").select("*").eq("id", user.id).single();
  if (!usuario) redirect("/login");

  const currentYear = new Date().getFullYear();

  const { data: indicadores } = await admin
    .from("indicadores")
    .select(`*, responsable:usuarios!responsable_id (id, nombre, email)`)
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (!indicadores || indicadores.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Indicadores de Gestión" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-slate-500 text-sm">No hay indicadores configurados.</p>
            {usuario.rol === "admin" && (
              <p className="text-xs text-slate-400">
                Ejecutá el seed en{" "}
                <code className="bg-slate-100 px-1 rounded">/api/admin/seed-indicadores</code>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicadorIds = (indicadores as any[]).map((i) => i.id);
  const { data: registros } = await admin
    .from("indicador_registros")
    .select("*")
    .in("indicador_id", indicadorIds)
    .eq("anio", currentYear)
    .order("mes", { ascending: true });

  const registrosByIndicador: Record<string, typeof registros> = {};
  for (const reg of registros ?? []) {
    if (!registrosByIndicador[reg.indicador_id]) registrosByIndicador[reg.indicador_id] = [];
    registrosByIndicador[reg.indicador_id]!.push(reg);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicadoresConRegistros = (indicadores as any[]).map((ind) => ({
    ...ind,
    registros: registrosByIndicador[ind.id] ?? [],
  }));

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Indicadores de Gestión" />
      <IndicadoresDashboard indicadores={indicadoresConRegistros} usuario={usuario as Usuario} />
    </div>
  );
}
