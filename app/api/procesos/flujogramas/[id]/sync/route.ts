import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

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

  const { flow_data, nodes } = await req.json();
  // nodes: Array<{ id, nombre, tipo, descripcion, sectores: string[], instructivo_id: string|null, orden: number }>

  // 1. Save flow_data + bump updated_at
  const { error: flujErr } = await admin
    .from("proc_flujogramas")
    .update({ flow_data, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (flujErr) return NextResponse.json({ error: flujErr.message }, { status: 500 });

  // 2. Sync proc_pasos — upsert all nodes, delete removed ones
  const nodeIds: string[] = nodes.map((n: { id: string }) => n.id);

  // Delete pasos that are no longer in the diagram
  if (nodeIds.length > 0) {
    await admin
      .from("proc_pasos")
      .delete()
      .eq("flujograma_id", params.id)
      .not("id", "in", `(${nodeIds.map((id) => `'${id}'`).join(",")})`);
  } else {
    await admin.from("proc_pasos").delete().eq("flujograma_id", params.id);
  }

  // Upsert each node as a paso
  for (const node of nodes) {
    const { id, nombre, tipo, descripcion, sectores, instructivo_id, orden } = node as {
      id: string; nombre: string; tipo: string; descripcion?: string;
      sectores: string[]; instructivo_id: string | null; orden: number;
    };

    await admin.from("proc_pasos").upsert({
      id,
      flujograma_id: params.id,
      nombre,
      tipo,
      descripcion: descripcion || null,
      orden,
    });

    // Sync sector links
    await admin.from("proc_paso_sectores").delete().eq("paso_id", id);
    if (sectores.length > 0) {
      await admin.from("proc_paso_sectores").insert(
        sectores.map((sid: string) => ({ paso_id: id, sector_id: sid }))
      );
    }

    // Sync instructivo link
    await admin.from("proc_paso_instructivos").delete().eq("paso_id", id);
    if (instructivo_id) {
      await admin.from("proc_paso_instructivos").insert({
        paso_id: id,
        instructivo_id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
