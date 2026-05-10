"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import { formatFecha } from "@/lib/utils/format";
import { TipoItem } from "@/types/database";
import { ChevronRight, FileText } from "lucide-react";

interface ItemRow {
  id: string;
  codigo: string;
  codigo_completo: string;
  tipo: TipoItem;
  clausula_iso: string;
  titulo: string;
  estado: string;
  fecha_vencimiento: string | null;
  version_actual: number;
  etiquetas: string[];
  es_borrador: boolean;
  usuarios?: { nombre: string } | { nombre: string }[] | null;
  areas?: { nombre: string } | { nombre: string }[] | null;
}

interface ItemsTableProps {
  items: ItemRow[];
}

export function ItemsTable({ items }: ItemsTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No se encontraron documentos</p>
        <p className="text-xs text-muted-foreground mt-1">Ajustá los filtros o creá un nuevo documento</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-32">Código</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="w-44">Tipo</TableHead>
            <TableHead className="w-24">Cláusula</TableHead>
            <TableHead className="w-32">Área</TableHead>
            <TableHead className="w-36">Responsable</TableHead>
            <TableHead className="w-28">Vencimiento</TableHead>
            <TableHead className="w-28">Estado</TableHead>
            <TableHead className="w-16">v.</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="group cursor-pointer">
              <TableCell>
                <Link href={`/items/${item.id}`} className="block">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {item.codigo}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="block">
                  <span className="font-medium text-sm line-clamp-1">{item.titulo}</span>
                  {item.etiquetas.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {item.etiquetas.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5">
                          {tag}
                        </Badge>
                      ))}
                      {item.etiquetas.length > 3 && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          +{item.etiquetas.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="block">
                  <span className="text-xs text-muted-foreground">
                    {TIPO_ITEM_LABELS[item.tipo]}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="block">
                  <Badge variant="outline" className="font-mono text-[10px]">{item.clausula_iso}</Badge>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="block">
                  <span className="text-xs text-muted-foreground">{(Array.isArray(item.areas) ? item.areas[0]?.nombre : item.areas?.nombre) ?? "—"}</span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="block">
                  <span className="text-xs text-muted-foreground">{(Array.isArray(item.usuarios) ? item.usuarios[0]?.nombre : item.usuarios?.nombre) ?? "—"}</span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="block">
                  <span className={`text-xs ${item.estado === "vencido" ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {formatFecha(item.fecha_vencimiento)}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="block">
                  <EstadoBadge estado={item.estado as import("@/types/database").EstadoItem} />
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="block">
                  <span className="text-xs text-muted-foreground">v{item.version_actual}</span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="block text-muted-foreground group-hover:text-foreground transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
        {items.length} {items.length === 1 ? "documento" : "documentos"}
      </div>
    </div>
  );
}
