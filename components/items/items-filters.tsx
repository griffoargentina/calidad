"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TIPO_ITEM_LABELS, ESTADO_LABELS } from "@/lib/constants/items";
import { TipoItem, EstadoItem } from "@/types/database";
import { X, SlidersHorizontal } from "lucide-react";

interface FiltersProps {
  areas: { id: string; nombre: string }[];
  clausulas: { id: string; titulo: string }[];
  searchParams: Record<string, string | undefined>;
}

const ESTADOS: EstadoItem[] = ["vigente", "por_vencer", "vencido", "obsoleto", "pendiente_aprobacion"];

export function ItemsFilters({ areas, clausulas, searchParams }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const setFilter = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(
      Object.entries(searchParams).filter(([, v]) => v !== undefined) as [string, string][]
    );
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const clearAll = () => router.push(pathname);

  const hasFilters = Object.values(searchParams).some(Boolean);
  const activeCount = Object.values(searchParams).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Búsqueda por texto */}
        <Input
          placeholder="Buscar por título o código..."
          defaultValue={searchParams.q}
          onChange={(e) => {
            const v = e.target.value;
            clearTimeout((window as any).__searchTimer);
            (window as any).__searchTimer = setTimeout(() => setFilter("q", v || null), 300);
          }}
          className="w-56 h-9"
        />

        {/* Estado */}
        <Select value={searchParams.estado ?? ""} onValueChange={(v) => setFilter("estado", v || null)}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los estados</SelectItem>
            {ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>{ESTADO_LABELS[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tipo */}
        <Select value={searchParams.tipo ?? ""} onValueChange={(v) => setFilter("tipo", v || null)}>
          <SelectTrigger className="w-52 h-9">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los tipos</SelectItem>
            {(Object.entries(TIPO_ITEM_LABELS) as [TipoItem, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Área */}
        {areas.length > 0 && (
          <Select value={searchParams.area ?? ""} onValueChange={(v) => setFilter("area", v || null)}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las áreas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Cláusula */}
        <Select value={searchParams.clausula ?? ""} onValueChange={(v) => setFilter("clausula", v || null)}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Cláusula ISO" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas las cláusulas</SelectItem>
            {clausulas.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.id} — {c.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground h-9">
            <X className="h-3.5 w-3.5 mr-1" />
            Limpiar
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{activeCount}</Badge>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
