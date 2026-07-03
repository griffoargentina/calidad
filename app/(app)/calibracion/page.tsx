import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/topbar";
import { CalibracionTabs } from "@/components/calibracion/calibracion-tabs";

export const dynamic = "force-dynamic";

export default async function CalibracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const [
    { data: procedimientos },
    { data: equipos },
    { data: calibraciones },
    { data: usuarioData },
    { data: archivosProc },
  ] = await Promise.all([
    admin.from("procedimientos_calibracion").select("*").order("titulo"),
    admin.from("equipos_calibracion").select(`
      *,
      procedimiento:procedimientos_calibracion(id, titulo)
    `).order("nombre"),
    admin.from("calibraciones").select("*").order("fecha_calibracion", { ascending: false }),
    admin.from("usuarios").select("rol").eq("id", user?.id ?? "").single(),
    admin.from("archivos").select("referencia_id, codigo").eq("modulo", "calibracion").eq("categoria", "procedimiento").not("codigo", "is", null),
  ]);

  // Map archivos codes to procedimientos
  const codigosProcMap = Object.fromEntries(
    (archivosProc ?? []).map((a) => [(a as { referencia_id: string; codigo: string }).referencia_id, (a as { referencia_id: string; codigo: string }).codigo])
  );
  const procedimientosConCodigo = (procedimientos ?? []).map((p) => ({
    ...p,
    codigo_doc: codigosProcMap[(p as { id: string }).id] ?? null,
  }));

  // Build latest calibracion map per equipo
  const calibracionesMap: Record<string, unknown> = Object.fromEntries(
    (calibraciones ?? []).reduce((acc, c) => {
      const equipo_id = (c as { equipo_id: string }).equipo_id;
      if (!acc.has(equipo_id)) acc.set(equipo_id, c);
      return acc;
    }, new Map<string, unknown>()).entries()
  );

  const equiposConCalib = (equipos ?? []).map((e) => ({
    ...e,
    ultima_calibracion: calibracionesMap[(e as { id: string }).id] ?? null,
  }));

  const canEdit = usuarioData?.rol === "admin" || usuarioData?.rol === "editor";

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Calibración" />
      <div className="flex-1 p-6 overflow-auto">
        <CalibracionTabs
          procedimientosIniciales={procedimientosConCodigo}
          equiposIniciales={equiposConCalib}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
