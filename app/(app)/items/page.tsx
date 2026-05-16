import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { ItemsTable } from "@/components/items/items-table";
import { ItemsFilters } from "@/components/items/items-filters";
import Link from "next/link";
import { Plus } from "lucide-react";

interface PageProps {
  searchParams: {
    estado?: string;
    tipo?: string;
    area?: string;
    clausula?: string;
    etiqueta?: string;
    q?: string;
    borrador?: string;
  };
}

export default async function ItemsPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  // Cargar áreas y cláusulas para los filtros
  const [{ data: areas }, { data: clausulas }, { data: usuario }] = await Promise.all([
    supabase.from("areas").select("id, nombre").eq("activa", true).order("nombre"),
    supabase.from("clausulas_iso").select("id, titulo"),
    supabase.from("usuarios").select("rol, area_id, tipos_habilitados")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .single(),
  ]);

  // Construir query de items con filtros
  let query = supabase
    .from("items")
    .select(`
      id, codigo, codigo_completo, codigo_formal, tipo, clausula_iso, titulo, estado,
      fecha_vencimiento, version_actual, etiquetas, es_borrador, responsable_id,
      area_id, created_at, updated_at,
      usuarios!responsable_id(nombre),
      areas(nombre)
    `)
    .order("updated_at", { ascending: false });

  // Mostrar todos los items activos (nunca ocultamos por es_borrador — ese flujo fue eliminado)
  query = query.neq("estado", "obsoleto");

  if (searchParams.estado) query = query.eq("estado", searchParams.estado);
  if (searchParams.tipo) query = query.eq("tipo", searchParams.tipo);
  if (searchParams.area) query = query.eq("area_id", searchParams.area);
  if (searchParams.clausula) query = query.eq("clausula_iso", searchParams.clausula);
  if (searchParams.etiqueta) query = query.contains("etiquetas", [searchParams.etiqueta]);
  if (searchParams.q) {
    query = query.or(
      `titulo.ilike.%${searchParams.q}%,codigo.ilike.%${searchParams.q}%,descripcion.ilike.%${searchParams.q}%`
    );
  }

  const { data: items } = await query.limit(200);

  // Archivos: nombre del más reciente por item + qué categorías tiene cada item
  const { data: archivosExistentes } = await supabase
    .from("archivos")
    .select("item_id, nombre_archivo, categoria")
    .order("subido_at", { ascending: false });

  // Por item: lista de { categoria, nombre } — uno por categoría (el más reciente primero)
  const archivosDetalle: Record<string, { categoria: string; nombre: string }[]> = {};

  for (const a of archivosExistentes ?? []) {
    const cat = a.categoria ?? "documento";
    if (!archivosDetalle[a.item_id]) archivosDetalle[a.item_id] = [];
    if (!archivosDetalle[a.item_id].find((x) => x.categoria === cat)) {
      archivosDetalle[a.item_id].push({ categoria: cat, nombre: a.nombre_archivo });
    }
  }

  const sortClausulas = (list: { id: string; titulo: string }[]) =>
    list.sort((a, b) => {
      const pa = a.id.split(".").map(Number);
      const pb = b.id.split(".").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });

  const canEdit = usuario?.rol === "admin" || usuario?.rol === "editor";

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Documentos del SGC"
        actions={
          canEdit && (
            <Button asChild size="sm">
              <Link href="/items/nuevo">
                <Plus className="h-4 w-4 mr-1" />
                Nuevo
              </Link>
            </Button>
          )
        }
      />

      <div className="flex-1 p-6 space-y-4">
        <ItemsFilters
          areas={areas ?? []}
          clausulas={sortClausulas(clausulas ?? [])}
          searchParams={searchParams}
        />
        <ItemsTable items={items ?? []} archivosDetalle={archivosDetalle} />
      </div>
    </div>
  );
}
