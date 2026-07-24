import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { ItemsTable } from "@/components/items/items-table";
import { ItemsFilters } from "@/components/items/items-filters";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TipoItem } from "@/types/database";

interface PageProps {
  searchParams: {
    estado?: string;
    tipo_documento?: string;
    area?: string;
    clausula?: string;
    etiqueta?: string;
    q?: string;
    borrador?: string;
  };
}

export default async function ItemsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: areas }, { data: clausulas }, { data: usuario }] = await Promise.all([
    supabase.from("areas").select("id, nombre").eq("activa", true).order("nombre"),
    supabase.from("clausulas_iso").select("id, titulo"),
    supabase.from("usuarios").select("rol, area_id, tipos_habilitados")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .single(),
  ]);

  // --- ISO items ---
  let query = supabase
    .from("items")
    .select(`
      id, codigo, codigo_completo, tipo_documento, tipo, clausula_iso, titulo, estado,
      fecha_vencimiento, version_actual, etiquetas, es_borrador, responsable_id,
      area_id, created_at, updated_at, metadata,
      usuarios!responsable_id(nombre),
      areas(nombre)
    `)
    .order("updated_at", { ascending: false });

  query = query.neq("estado", "obsoleto");

  if (searchParams.estado) query = query.eq("estado", searchParams.estado);
  if (searchParams.tipo_documento) query = query.eq("tipo_documento", searchParams.tipo_documento);
  if (searchParams.area) query = query.eq("area_id", searchParams.area);
  if (searchParams.clausula) query = query.eq("clausula_iso", searchParams.clausula);
  if (searchParams.etiqueta) query = query.contains("etiquetas", [searchParams.etiqueta]);
  if (searchParams.q) {
    query = query.or(
      `titulo.ilike.%${searchParams.q}%,codigo.ilike.%${searchParams.q}%,descripcion.ilike.%${searchParams.q}%`
    );
  }

  const { data: items } = await query.limit(200);

  // --- Archivos de items ISO ---
  const { data: archivosExistentes } = await supabase
    .from("archivos")
    .select("item_id, nombre_archivo, categoria, archivo_url")
    .order("subido_at", { ascending: false });

  const archivosDetalle: Record<string, { categoria: string; nombre: string; url: string }[]> = {};

  for (const a of archivosExistentes ?? []) {
    const cat = a.categoria ?? "documento";
    if (!archivosDetalle[a.item_id]) archivosDetalle[a.item_id] = [];
    if (!archivosDetalle[a.item_id].find((x) => x.categoria === cat)) {
      archivosDetalle[a.item_id].push({ categoria: cat, nombre: a.nombre_archivo, url: a.archivo_url ?? "" });
    }
  }

  // --- Instructivos de procesos ---
  // Only fetch when no clausula/area/tipo_documento filter active (they don't apply to instructivos)
  const skipProcesos = !!(searchParams.clausula || searchParams.area || searchParams.tipo_documento);

  let instructivoRows: ReturnType<typeof buildItemRow>[] = [];
  let flujogramaRows: ReturnType<typeof buildItemRow>[] = [];

  if (!skipProcesos) {
    let instQuery = admin
      .from("proc_instructivos")
      .select(`id, nombre, version, estado, codigo, responsable_id, url_archivo, nombre_archivo, sector:proc_sectores(id, nombre), responsable:usuarios!responsable_id(nombre)`)
      .neq("estado", "historico")
      .order("nombre");

    if (searchParams.estado) instQuery = instQuery.eq("estado", searchParams.estado);
    if (searchParams.q) instQuery = instQuery.ilike("nombre", `%${searchParams.q}%`);

    const { data: instructivosRaw } = await instQuery;

    let flujQuery = admin
      .from("proc_flujogramas")
      .select(`id, nombre, version, estado, codigo, sector:proc_sectores(id, nombre)`)
      .neq("estado", "historico")
      .order("nombre");

    if (searchParams.estado) flujQuery = flujQuery.eq("estado", searchParams.estado);
    if (searchParams.q) flujQuery = flujQuery.ilike("nombre", `%${searchParams.q}%`);

    const { data: flujogramasRaw } = await flujQuery;

    // Archivos de instructivos y flujogramas (keyed by referencia_id)
    const { data: archivosProc } = await admin
      .from("archivos")
      .select("referencia_id, nombre_archivo, categoria, codigo")
      .in("modulo", ["instructivos", "flujogramas"])
      .order("subido_at", { ascending: false });

    for (const a of archivosProc ?? []) {
      if (!a.referencia_id) continue;
      const key = a.referencia_id;
      if (!archivosDetalle[key]) archivosDetalle[key] = [];
      const cat = a.categoria ?? "documento";
      if (!archivosDetalle[key].find((x) => x.categoria === cat)) {
        archivosDetalle[key].push({
          categoria: cat,
          nombre: a.codigo ? `${a.codigo} — ${a.nombre_archivo}` : a.nombre_archivo,
          url: "",
        });
      }
    }

    instructivoRows = (instructivosRaw ?? []).map((inst) => {
      const sector = Array.isArray(inst.sector) ? inst.sector[0] : inst.sector;
      const resp = Array.isArray(inst.responsable) ? inst.responsable[0] : inst.responsable;
      return buildItemRow({
        id: inst.id, codigo: inst.codigo, nombre: inst.nombre,
        tipo: "instructivo" as TipoItem, sector, resp, estado: inst.estado, version: inst.version,
      });
    });

    flujogramaRows = (flujogramasRaw ?? []).map((fluj) => {
      const sector = Array.isArray(fluj.sector) ? fluj.sector[0] : fluj.sector;
      return buildItemRow({
        id: fluj.id, codigo: fluj.codigo, nombre: fluj.nombre,
        tipo: "flujograma" as TipoItem, sector, resp: null, estado: fluj.estado, version: fluj.version,
      });
    });
  }

  const allItems = [...(items ?? []), ...instructivoRows, ...flujogramaRows];

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
        {skipProcesos && (
          <p className="text-xs text-muted-foreground">
            Filtro activo: mostrando solo documentos ISO. Quitá el filtro de cláusula/área/tipo para ver también instructivos y flujogramas de procesos.
          </p>
        )}
        <ItemsTable items={allItems} archivosDetalle={archivosDetalle} />
      </div>
    </div>
  );
}

function buildItemRow({
  id, codigo, nombre, tipo, sector, resp, estado, version,
}: {
  id: string;
  codigo: string | null | undefined;
  nombre: string;
  tipo: TipoItem;
  sector: { id: string; nombre: string } | null | undefined;
  resp: { nombre: string } | null | undefined;
  estado: string;
  version: number;
}) {
  const sectorNombre = sector?.nombre ?? "—";
  return {
    id,
    codigo: codigo?.match(/\d+/)?.[0] ?? "",
    codigo_completo: codigo ?? "",
    codigo_formal: codigo ?? null,
    tipo,
    clausula_iso: sectorNombre,
    titulo: nombre,
    estado,
    fecha_vencimiento: null as string | null,
    version_actual: version,
    etiquetas: [] as string[],
    es_borrador: estado === "borrador",
    metadata: null,
    usuarios: resp ?? null,
    areas: sector ? { nombre: sectorNombre } : null,
  };
}
