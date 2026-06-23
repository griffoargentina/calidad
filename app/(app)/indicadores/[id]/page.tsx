import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { IndicadorDetalle } from "@/components/indicadores/indicador-detalle";
import { Usuario } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function IndicadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await admin
    .from("usuarios")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!usuario) redirect("/login");

  const { data: indicador, error } = await admin
    .from("indicadores")
    .select(
      `
      *,
      responsable:usuarios!responsable_id (
        id,
        nombre,
        email
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !indicador) {
    notFound();
  }

  const { data: registros } = await admin
    .from("indicador_registros")
    .select(
      `
      *,
      cargado_por_usuario:usuarios!cargado_por (
        id,
        nombre
      )
    `
    )
    .eq("indicador_id", id)
    .order("anio", { ascending: false })
    .order("mes", { ascending: false, nullsFirst: false });

  const indicadorConRegistros = {
    ...indicador,
    registros: registros ?? [],
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar title={indicador.nombre} />
      <IndicadorDetalle
        indicador={indicadorConRegistros}
        usuario={usuario as Usuario}
      />
    </div>
  );
}
