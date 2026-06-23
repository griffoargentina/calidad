"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ESTADO_LABELS } from "@/lib/constants/items";
import { EstadoItem } from "@/types/database";
import { X, SlidersHorizontal } from "lucide-react";

const TIPO_DOCUMENTO_OPTIONS = [
  { value: "MA", label: "MA — Manual" },
  { value: "PR", label: "PR — Procedimiento" },
  { value: "IT", label: "IT — Instructivo de Trabajo" },
  { value: "FO", label: "FO — Formato / Formulario" },
  { value: "RE", label: "RE — Registro" },
];

interface FiltersProps {
  areas: { id: string; nombre: string }[];
  clausulas: { id: string; titulo: string }[];
  searchParams: Record<string, string | undefined>;
}

const ESTADOS: EstadoItem[] = ["vigente", "por_vencer", "vencido", "obsoleto"];
const ALL = "_all_";

export function ItemsFilters({ areas, clausulas, searchParams }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(searchParams.q ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFilter = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(
      Object.entries(searchParams).filter(([, v]) => v !== undefined) as [string, string][]
    );
    if (value && value !== ALL) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const clearAll = () => { setSearchValue(""); router.push(pathname); };

  const hasFilters = Object.values(searchParams).some(Boolean);
  const activeCount = Object.values(searchParams).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Búsqueda por texto */}
        <Input
          placeholder="Buscar por título o código..."
          value={searchValue}
          onChange={(e) => {
            const v = e.target.value;
            setSearchValue(v);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setFilter("q", v || null), 300);
          }}
          className="w-56 h-9"
        />

        {/* Estado */}
        <Select value={searchParams.estado ?? ALL} onValueChange={(v) => setFilter("estado", v)}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>{ESTADO_LABELS[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tipo de documento */}
        <Select value={searchParams.tipo_documento ?? ALL} onValueChange={(v) => setFilter("tipo_documento", v)}>
          <SelectTrigger className="w-52 h-9">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {TIPO_DOCUMENTO_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Área */}
        {areas.length > 0 && (
          <Select value={searchParams.area ?? ALL} onValueChange={(v) => setFilter("area", v)}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las áreas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Cláusula */}
        <Select value={searchParams.clausula ?? ALL} onValueChange={(v) => setFilter("clausula", v)}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Cláusula ISO" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las cláusulas</SelectItem>
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
