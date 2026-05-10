import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { ItemForm } from "@/components/items/item-form";

export default async function EditarItemPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: item }, { data: usuario }] = await Promise.all([
    supabase.from("items").select("*").eq("id", params.id).single(),
    supabase.from("usuarios").select("*").eq("id", user.id).single(),
  ]);

  if (!item) notFound();

  const canEdit = usuario?.rol === "admin" || (
    usuario?.rol === "editor" && (
      item.responsable_id === user.id ||
      item.area_id === usuario.area_id ||
      (usuario.tipos_habilitados as string[]).includes(item.tipo)
    )
  );

  if (!canEdit) redirect(`/items/${params.id}`);

  const [{ data: areas }, { data: clausulas }, { data: usuarios }, { data: plantillas }] = await Promise.all([
    supabase.from("areas").select("id, nombre").eq("activa", true).order("nombre"),
    supabase.from("clausulas_iso").select("id, titulo").order("id"),
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("plantillas").select("*").order("nombre"),
  ]);

  return (
    <div className="flex flex-col h-full">
      <Topbar title={`Editar — ${item.codigo}`} />
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <ItemForm
          areas={areas ?? []}
          clausulas={clausulas ?? []}
          usuarios={usuarios ?? []}
          plantillas={plantillas ?? []}
          usuarioActual={{ rol: usuario?.rol, area_id: usuario?.area_id, tipos_habilitados: usuario?.tipos_habilitados }}
          itemInicial={item}
        />
      </div>
    </div>
  );
}
