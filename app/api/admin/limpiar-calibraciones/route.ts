import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: caller } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (caller?.rol !== "admin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  // 1. Listar y borrar archivos del storage en calibracion/
  const { data: files, error: listError } = await admin.storage
    .from("documentos")
    .list("calibracion", { limit: 1000 });

  let storageDeleted = 0;
  if (!listError && files && files.length > 0) {
    const allPaths: string[] = [];
    for (const item of files) {
      if (item.id === null) {
        // Es una carpeta, listar su contenido
        const { data: subFiles } = await admin.storage
          .from("documentos")
          .list("calibracion/" + item.name, { limit: 1000 });
        for (const sf of subFiles ?? []) {
          allPaths.push("calibracion/" + item.name + "/" + sf.name);
        }
      } else {
        allPaths.push("calibracion/" + item.name);
      }
    }
    if (allPaths.length > 0) {
      const { error: removeError } = await admin.storage.from("documentos").remove(allPaths);
      if (!removeError) storageDeleted = allPaths.length;
    }
  }

  // 2. Borrar todos los registros de calibraciones
  const { error: delCalib } = await admin.from("calibraciones").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delCalib) return NextResponse.json({ error: "Error borrando calibraciones: " + delCalib.message }, { status: 500 });

  return NextResponse.json({ ok: true, archivosEliminados: storageDeleted, mensaje: "Calibraciones y archivos eliminados" });
}
