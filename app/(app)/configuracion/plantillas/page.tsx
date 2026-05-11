import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { PlantillasManager } from "@/components/items/plantillas-manager";

export default async function PlantillasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol === "lector") redirect("/items");

  const [{ data: plantillas }, { data: areas }] = await Promise.all([
    supabase.from("plantillas").select("*, usuarios!created_by(nombre)").order("nombre"),
    supabase.from("areas").select("id, nombre").eq("activa", true).order("nombre"),
  ]);

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Plantillas de documentos" />
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <PlantillasManager
          plantillas={plantillas ?? []}
          areas={areas ?? []}
        />
      </div>
    </div>
  );
}
