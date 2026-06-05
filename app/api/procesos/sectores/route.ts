import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  const rol = usuario?.rol ?? "lector";

  const { data: sectores, error } = await admin
    .from("proc_sectores")
    .select("*")
    .eq("activo", true)
    .order("orden");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter private sectors for lectores (non-admin, non-responsable)
  let visibles = sectores ?? [];
  if (rol !== "admin") {
    const { data: misResponsables } = await admin
      .from("proc_sector_responsables")
      .select("sector_id")
      .eq("usuario_id", user.id);
    const misIds = new Set((misResponsables ?? []).map((r: { sector_id: string }) => r.sector_id));
    visibles = visibles.filter((s: { privado: boolean; id: string }) => !s.privado || misIds.has(s.id));
  }

  const sectorIds = visibles.map((s: { id: string }) => s.id);
  const NULL_ID = "00000000-0000-0000-0000-000000000000";

  const [{ data: flujogramas }, { data: instructivos }] = await Promise.all([
    admin.from("proc_flujogramas").select("id, sector_id").in("sector_id", sectorIds.length ? sectorIds : [NULL_ID]),
    admin.from("proc_instructivos").select("id, sector_id, estado").in("sector_id", sectorIds.length ? sectorIds : [NULL_ID]),
  ]);

  const flujoCountBySector: Record<string, number> = {};
  for (const f of flujogramas ?? []) {
    const fl = f as { id: string; sector_id: string };
    flujoCountBySector[fl.sector_id] = (flujoCountBySector[fl.sector_id] ?? 0) + 1;
  }

  const instrCountBySector: Record<string, number> = {};
  const alertaBySector: Record<string, boolean> = {};
  for (const i of instructivos ?? []) {
    const inst = i as { id: string; sector_id: string; estado: string };
    instrCountBySector[inst.sector_id] = (instrCountBySector[inst.sector_id] ?? 0) + 1;
    if (inst.estado === "pendiente_aprobacion" || inst.estado === "rechazado") {
      alertaBySector[inst.sector_id] = true;
    }
  }

  const result = visibles.map((s: { id: string }) => ({
    ...s,
    count_flujogramas: flujoCountBySector[(s as { id: string }).id] ?? 0,
    count_instructivos: instrCountBySector[(s as { id: string }).id] ?? 0,
    tiene_alerta: alertaBySector[(s as { id: string }).id] ?? false,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || usuario.rol !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, descripcion, privado, responsables } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const { data: maxOrden } = await admin
    .from("proc_sectores")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .single();

  const { data: sector, error } = await admin
    .from("proc_sectores")
    .insert({
      nombre: nombre.trim(),
      descripcion: descripcion || null,
      privado: privado ?? false,
      orden: (maxOrden?.orden ?? 0) + 1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Assign responsables if provided
  if (Array.isArray(responsables) && responsables.length > 0) {
    await admin.from("proc_sector_responsables").insert(
      responsables.map((uid: string) => ({ sector_id: sector.id, usuario_id: uid }))
    );
  }

  return NextResponse.json({
    ...sector,
    count_flujogramas: 0,
    count_instructivos: 0,
    tiene_alerta: false,
  }, { status: 201 });
}
