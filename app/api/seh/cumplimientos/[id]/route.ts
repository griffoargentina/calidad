import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { fecha_vencimiento, fecha_planificada, fecha_realizada, observacion, responsable_id } = body;

  const { data: cumplimiento, error } = await admin
    .from("seh_cumplimientos")
    .update({
      ...(fecha_vencimiento !== undefined && { fecha_vencimiento: fecha_vencimiento || null }),
      ...(fecha_planificada !== undefined && { fecha_planificada: fecha_planificada || null }),
      ...(fecha_realizada !== undefined && { fecha_realizada: fecha_realizada || null }),
      ...(observacion !== undefined && { observacion: observacion || null }),
      ...(responsable_id !== undefined && { responsable_id: responsable_id || null }),
    })
    .eq("id", id)
    .select("*, requisito:seh_requisitos(id, tipo_vencimiento, periodicidad_meses)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-renovación: si se marcó fecha_realizada y el tipo es anual/periodico,
  // crear el siguiente cumplimiento
  if (fecha_realizada && cumplimiento) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req_data = (cumplimiento as any).requisito;
    const tipo = req_data?.tipo_vencimiento;
    const meses = req_data?.periodicidad_meses;

    let nextMeses: number | null = null;
    if (tipo === "anual") nextMeses = 12;
    else if (tipo === "periodico" && meses) nextMeses = meses;

    if (nextMeses) {
      const baseDate = new Date(fecha_realizada);
      baseDate.setMonth(baseDate.getMonth() + nextMeses);
      const nextVencimiento = baseDate.toISOString().split("T")[0];

      // Verificar que no exista ya un cumplimiento futuro
      const { data: existing } = await admin
        .from("seh_cumplimientos")
        .select("id")
        .eq("requisito_id", cumplimiento.requisito_id)
        .gt("fecha_vencimiento", fecha_realizada)
        .limit(1);

      if (!existing || existing.length === 0) {
        await admin.from("seh_cumplimientos").insert({
          requisito_id: cumplimiento.requisito_id,
          fecha_vencimiento: nextVencimiento,
          responsable_id: user.id,
        });
      }
    }
  }

  return NextResponse.json(cumplimiento);
}
