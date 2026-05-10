import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { ItemForm } from "@/components/items/item-form";

export default async function NuevoItemPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol, area_id, tipos_habilitados")
    .eq("id", user.id)
    .single();

  if (usuario?.rol === "lector") redirect("/items");

  const [{ data: areas }, { data: clausulas }, { data: usuarios }, { data: plantillas }] = await Promise.all([
    supabase.from("areas").select("id, nombre").eq("activa", true).order("nombre"),
    supabase.from("clausulas_iso").select("id, titulo").order("id"),
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("plantillas").select("*").order("nombre"),
  ]);

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Nuevo documento" />
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <ItemForm
          areas={areas ?? []}
          clausulas={clausulas ?? []}
          usuarios={usuarios ?? []}
          plantillas={plantillas ?? []}
          usuarioActual={{ rol: usuario?.rol, area_id: usuario?.area_id, tipos_habilitados: usuario?.tipos_habilitados }}
        />
      </div>
    </div>
  );
}
