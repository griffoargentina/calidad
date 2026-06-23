import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("proc_pasos")
    .select("*, paso_sectores:proc_paso_sectores(sector_id), paso_instructivo:proc_paso_instructivos(instructivo_id)")
    .eq("flujograma_id", params.id)
    .order("orden");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, tipo, descripcion, sectores } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  // Get current max orden
  const { data: maxPaso } = await admin
    .from("proc_pasos")
    .select("orden")
    .eq("flujograma_id", params.id)
    .order("orden", { ascending: false })
    .limit(1)
    .single();

  const orden = (maxPaso?.orden ?? -1) + 1;

  const { data: paso, error } = await admin
    .from("proc_pasos")
    .insert({
      flujograma_id: params.id,
      nombre: nombre.trim(),
      tipo: tipo ?? "proceso",
      descripcion: descripcion || null,
      orden,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(sectores) && sectores.length > 0) {
    await admin.from("proc_paso_sectores").insert(
      sectores.map((sid: string) => ({ paso_id: paso.id, sector_id: sid }))
    );
  }

  return NextResponse.json(paso, { status: 201 });
}

// PUT: reorder — accepts full ordered array of paso objects with at least {id, orden}
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (!usuario || !["admin", "editor"].includes(usuario.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const pasos: Array<{ id: string; orden: number }> = await req.json();
  if (!Array.isArray(pasos)) return NextResponse.json({ error: "Array requerido" }, { status: 400 });

  // Update orden for each paso
  await Promise.all(
    pasos.map((p) =>
      admin.from("proc_pasos").update({ orden: p.orden }).eq("id", p.id).eq("flujograma_id", params.id)
    )
  );

  // Update flujograma timestamp
  await admin.from("proc_flujogramas").update({ updated_at: new Date().toISOString() }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
