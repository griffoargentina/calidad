import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import { formatFecha } from "@/lib/utils/format";
import { EstadoItem, TipoItem } from "@/types/database";
import { AlertTriangle, Clock, CheckCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface PageProps {
  searchParams: { responsable?: string };
}

export default async function VencimientosPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: todosItems } = await admin
    .from("items")
    .select("id, codigo, titulo, tipo, estado, fecha_vencimiento, clausula_iso, responsable_id, usuarios!responsable_id(id, nombre)")
    .eq("es_borrador", false)
    .neq("estado", "obsoleto")
    .not("fecha_vencimiento", "is", null)
    .order("fecha_vencimiento", { ascending: true });

  // Construir mapa responsable → { nombre, total, vencidos, porVencer }
  type PersonaStats = { id: string; nombre: string; total: number; vencidos: number; porVencer: number };
  const personaMap = new Map<string, PersonaStats>();

  for (const item of todosItems ?? []) {
    const u = Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios;
    const pid = item.responsable_id ?? "__sin_asignar__";
    const pnombre = u?.nombre ?? "Sin asignar";
    if (!personaMap.has(pid)) {
      personaMap.set(pid, { id: pid, nombre: pnombre, total: 0, vencidos: 0, porVencer: 0 });
    }
    const ps = personaMap.get(pid)!;
    ps.total++;
    if (item.estado === "vencido") ps.vencidos++;
    if (item.estado === "por_vencer") ps.porVencer++;
  }

  const personas = Array.from(personaMap.values()).sort((a, b) => b.vencidos - a.vencidos);

  // Filtrar por responsable si hay searchParam
  const filtroId = searchParams.responsable ?? null;
  const items = filtroId
    ? (todosItems ?? []).filter((i) => (i.responsable_id ?? "__sin_asignar__") === filtroId)
    : (todosItems ?? []);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Agrupar por mes/año
  const grupos = new Map<string, { label: string; items: typeof items }>();
  for (const item of items) {
    if (!item.fecha_vencimiento) continue;
    const fecha = new Date(item.fecha_vencimiento);
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MESES_ES[fecha.getMonth()]} ${fecha.getFullYear()}`;
    if (!grupos.has(key)) grupos.set(key, { label, items: [] });
    grupos.get(key)!.items!.push(item);
  }

  const gruposOrdenados = Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b));
  const mesActualKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const vencidosGrupos = gruposOrdenados.filter(([k]) => k < mesActualKey);
  const actualesYFuturos = gruposOrdenados.filter(([k]) => k >= mesActualKey);

  const totalVencidos  = items.filter(i => i.estado === "vencido").length;
  const totalPorVencer = items.filter(i => i.estado === "por_vencer").length;
  const totalVigentes  = items.filter(i => i.estado === "vigente").length;

  const filtroNombre = filtroId ? personaMap.get(filtroId)?.nombre : null;

  return (
    <div className="flex flex-col h-full">
      <Topbar title={filtroNombre ? `Vencimientos — ${filtroNombre}` : "Calendario de vencimientos"} />

      <div className="flex-1 p-6 space-y-6 max-w-4xl mx-auto w-full">

        {/* Filtro por persona */}
        {personas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por responsable</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/vencimientos"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  !filtroId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                Todos
              </Link>
              {personas.map((p) => (
                <Link
                  key={p.id}
                  href={`/vencimientos?responsable=${p.id}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filtroId === p.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white border-border text-foreground hover:border-primary"
                  }`}
                >
                  {p.nombre}
                  {p.vencidos > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full text-[10px] font-bold px-1 ${
                      filtroId === p.id ? "bg-white text-red-600" : "bg-red-500 text-white"
                    }`}>
                      {p.vencidos}
                    </span>
                  )}
                  {p.vencidos === 0 && p.porVencer > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full text-[10px] font-bold px-1 ${
                      filtroId === p.id ? "bg-white text-yellow-600" : "bg-yellow-400 text-white"
                    }`}>
                      {p.porVencer}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-lg border bg-red-50 border-red-200 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-red-700">{totalVencidos}</p>
              <p className="text-xs text-red-600">Vencidos</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-yellow-50 border-yellow-200 px-4 py-3">
            <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{totalPorVencer}</p>
              <p className="text-xs text-yellow-600">Por vencer ≤30 días</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-green-50 border-green-200 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-green-700">{totalVigentes}</p>
              <p className="text-xs text-green-600">Vigentes con vencimiento</p>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-lg">
            <CheckCircle2 className="h-10 w-10 text-green-400 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No hay documentos con fecha de vencimiento cargados.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {vencidosGrupos.map(([key, grupo]) => (
              <GrupoMes key={key} label={grupo.label} items={grupo.items ?? []} esPasado />
            ))}
            {actualesYFuturos.map(([key, grupo]) => (
              <GrupoMes key={key} label={grupo.label} items={grupo.items ?? []} esActual={key === mesActualKey} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type ItemRow = {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  estado: string;
  fecha_vencimiento: string | null;
  clausula_iso: string;
  responsable_id?: string | null;
  usuarios?: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
};

function GrupoMes({ label, items, esPasado, esActual }: {
  label: string;
  items: ItemRow[];
  esPasado?: boolean;
  esActual?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h3 className={`text-sm font-semibold ${esPasado ? "text-red-600" : esActual ? "text-primary" : "text-slate-700"}`}>
          {label}
          {esPasado && <span className="ml-2 text-xs font-normal text-red-500">(vencido)</span>}
          {esActual && <span className="ml-2 text-xs font-normal text-muted-foreground">(mes actual)</span>}
        </h3>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">{items.length} doc.</span>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden divide-y">
        {items.map((item) => {
          const responsable = Array.isArray(item.usuarios)
            ? item.usuarios[0]?.nombre
            : item.usuarios?.nombre;
          return (
            <Link
              key={item.id}
              href={`/items/${item.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{item.codigo}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {TIPO_ITEM_LABELS[item.tipo as TipoItem]} · {item.clausula_iso}
                  {responsable && ` · ${responsable}`}
                </p>
              </div>
              <EstadoBadge estado={item.estado as EstadoItem} />
              <span className={`text-xs shrink-0 font-medium ${esPasado || item.estado === "vencido" ? "text-red-500" : item.estado === "por_vencer" ? "text-yellow-600" : "text-muted-foreground"}`}>
                {formatFecha(item.fecha_vencimiento)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
