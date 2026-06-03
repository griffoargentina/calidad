"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, ColumnDef, SortingState, ColumnResizeMode,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/shared/estado-badge";
import { TIPO_ITEM_LABELS } from "@/lib/constants/items";
import { formatFecha } from "@/lib/utils/format";
import { TipoItem, EstadoItem } from "@/types/database";
import { FileText, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface ItemRow {
  id: string;
  codigo: string;
  codigo_completo: string;
  codigo_formal?: string | null;
  tipo: TipoItem;
  clausula_iso: string;
  titulo: string;
  estado: string;
  fecha_vencimiento: string | null;
  version_actual: number;
  etiquetas: string[];
  es_borrador: boolean;
  metadata?: { documento_na?: boolean; procedimiento_na?: boolean } | null;
  usuarios?: { nombre: string } | { nombre: string }[] | null;
  areas?: { nombre: string } | { nombre: string }[] | null;
}

interface ArchivoDetalle {
  categoria: string;
  nombre: string;
  url: string;
}

interface ItemsTableProps {
  items: ItemRow[];
  archivosDetalle?: Record<string, ArchivoDetalle[]>;
}

function getUsuarioNombre(u: ItemRow["usuarios"]) {
  return (Array.isArray(u) ? u[0]?.nombre : u?.nombre) ?? "—";
}
function getAreaNombre(a: ItemRow["areas"]) {
  return (Array.isArray(a) ? a[0]?.nombre : a?.nombre) ?? "—";
}

export function ItemsTable({ items, archivosDetalle }: ItemsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columnResizeMode: ColumnResizeMode = "onChange";
  const router = useRouter();
  const [naOverrides, setNaOverrides] = useState<Record<string, boolean>>({});

  async function toggleDocumentoNa(itemId: string, current: boolean) {
    const next = !current;
    setNaOverrides((prev) => ({ ...prev, [itemId]: next }));
    await fetch(`/api/items/${itemId}/quick-edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documento_na: next }),
    });
    router.refresh();
  }

  const columns: ColumnDef<ItemRow>[] = [
    {
      accessorKey: "codigo",
      header: "Código",
      size: 120,
      cell: ({ row }) => (
        <Link href={`/items/${row.original.id}`} className="block">
          <span className="font-mono text-xs font-semibold text-primary">{row.original.codigo}</span>
          {row.original.codigo_formal && (
            <span className="text-[10px] text-muted-foreground block mt-0.5">{row.original.codigo_formal}</span>
          )}
        </Link>
      ),
    },
    {
      accessorKey: "titulo",
      header: "Título",
      size: 220,
      cell: ({ row }) => (
        <Link href={`/items/${row.original.id}`} className="block">
          <span className="font-medium text-sm line-clamp-1">{row.original.titulo}</span>
          {row.original.etiquetas?.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {row.original.etiquetas.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5">{tag}</Badge>
              ))}
            </div>
          )}
        </Link>
      ),
    },
    {
      accessorKey: "tipo",
      header: "Tipo",
      size: 160,
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">
          {TIPO_ITEM_LABELS[getValue() as TipoItem]}
        </span>
      ),
    },
    {
      accessorKey: "clausula_iso",
      header: "Cláusula",
      size: 90,
      cell: ({ getValue }) => (
        <Badge variant="outline" className="font-mono text-[10px]">{getValue() as string}</Badge>
      ),
    },
    {
      id: "area",
      header: "Área",
      size: 110,
      accessorFn: (row) => getAreaNombre(row.areas),
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue() as string}</span>,
    },
    {
      id: "responsable",
      header: "Responsable",
      size: 130,
      accessorFn: (row) => getUsuarioNombre(row.usuarios),
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue() as string}</span>,
    },
    {
      accessorKey: "fecha_vencimiento",
      header: "Vencimiento",
      size: 110,
      cell: ({ row, getValue }) => (
        <span className={`text-xs ${row.original.estado === "vencido" ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
          {formatFecha(getValue() as string | null)}
        </span>
      ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      size: 110,
      cell: ({ row }) => {
        const id = row.original.id;
        const docNa = naOverrides[id] !== undefined ? naOverrides[id] : (row.original.metadata?.documento_na ?? false);
        const files = archivosDetalle?.[id];
        const hasProc = files?.some((f) => f.categoria === "procedimiento") ?? false;
        const hasAnyFile = (files?.length ?? 0) > 0;
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const fv = row.original.fecha_vencimiento
          ? new Date(row.original.fecha_vencimiento + "T00:00:00")
          : null;
        const isExpired = fv ? fv < hoy : false;
        const compliant = docNa ? hasProc : hasAnyFile;
        const estado: EstadoItem = (!compliant || isExpired) ? "vencido" : row.original.estado as EstadoItem;
        return <EstadoBadge estado={estado} />;
      },
    },
    {
      accessorKey: "version_actual",
      header: "v.",
      size: 50,
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground">v{getValue() as number}</span>,
    },
    {
      id: "archivos",
      header: "Tipo archivo",
      size: 90,
      enableSorting: false,
      enableResizing: false,
      cell: ({ row }) => {
        const id = row.original.id;
        const docNa = naOverrides[id] !== undefined ? naOverrides[id] : (row.original.metadata?.documento_na ?? false);
        const files = archivosDetalle?.[id];
        const hasDocFile = files?.some((f) => f.categoria !== "procedimiento") ?? false;
        return (
          <div className="flex flex-col gap-1">
            {files?.map(({ categoria }) => (
              <span key={categoria} className={`text-[10px] border rounded px-1.5 py-0.5 ${
                categoria === "procedimiento"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}>
                {categoria === "procedimiento" ? "Proc" : "Doc"}
              </span>
            ))}
            {!hasDocFile && (
              <button
                onClick={() => toggleDocumentoNa(id, docNa)}
                className={`text-[10px] border rounded px-1.5 py-0.5 text-left transition-colors ${
                  docNa
                    ? "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"
                    : "bg-white text-gray-400 border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-500"
                }`}
                title={docNa ? "Quitar N/A" : "Marcar como No Corresponde Documento"}
              >
                {docNa ? "N/A Doc ✕" : "+ N/A Doc"}
              </button>
            )}
          </div>
        );
      },
    },
    {
      id: "nombre_archivo",
      header: "Nombre archivo",
      size: 200,
      enableSorting: false,
      cell: ({ row }) => {
        const files = archivosDetalle?.[row.original.id];
        if (!files?.length) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col gap-1">
            {files.map(({ categoria, nombre }) => (
              <span key={categoria} className="text-xs text-muted-foreground block whitespace-normal" title={nombre}>
                {nombre}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
  });

  function exportToExcel() {
    const hoyExport = new Date(); hoyExport.setHours(0, 0, 0, 0);
    const rows = table.getSortedRowModel().rows.flatMap((row) => {
      const id = row.original.id;
      const files = archivosDetalle?.[id];
      const docNa = naOverrides[id] !== undefined ? naOverrides[id] : (row.original.metadata?.documento_na ?? false);
      const hasAnyFile = (files?.length ?? 0) > 0;
      const hasProc = files?.some((f) => f.categoria === "procedimiento") ?? false;
      const compliant = docNa ? hasProc : hasAnyFile;
      const fv = row.original.fecha_vencimiento ? new Date(row.original.fecha_vencimiento + "T00:00:00") : null;
      const isExpired = fv ? fv < hoyExport : false;
      const estadoReal: EstadoItem = (!compliant || isExpired) ? "vencido" : row.original.estado as EstadoItem;
      const base = {
        "Código": row.original.codigo,
        "Código formal": row.original.codigo_formal ?? "",
        "Título": row.original.titulo,
        Tipo: TIPO_ITEM_LABELS[row.original.tipo],
        "Cláusula": row.original.clausula_iso,
        "Área": getAreaNombre(row.original.areas),
        Responsable: getUsuarioNombre(row.original.usuarios),
        Vencimiento: row.original.fecha_vencimiento ?? "",
        Estado: estadoReal,
        "Versión": row.original.version_actual,
      };
      if (!files?.length) return [{ ...base, "Tipo archivo": "", "Nombre archivo": "", "Link archivo": "" }];
      return files.map(({ categoria, nombre, url }) => ({
        ...base,
        "Tipo archivo": categoria === "procedimiento" ? "Proc" : "Doc",
        "Nombre archivo": nombre,
        "Link archivo": url,
      }));
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Hacer la columna Link archivo clickeable en Excel
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    const linkCol = headers.indexOf("Link archivo");
    if (linkCol >= 0) {
      for (let r = 1; r <= range.e.r; r++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c: linkCol });
        const cell = ws[cellAddr];
        if (cell && cell.v) {
          cell.l = { Target: cell.v as string };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documentos");
    XLSX.writeFile(wb, `documentos_sgc_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

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
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportToExcel}>
          <Download className="h-4 w-4 mr-1.5" />
          Exportar Excel
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table style={{ width: table.getCenterTotalSize() }} className="text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-muted/30 border-b">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize(), position: "relative" }}
                    className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap select-none"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-1 ${header.column.getCanSort() ? "cursor-pointer hover:text-foreground" : ""}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          header.column.getIsSorted() === "asc" ? <ArrowUp className="h-3 w-3" /> :
                          header.column.getIsSorted() === "desc" ? <ArrowDown className="h-3 w-3" /> :
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </div>
                    )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-primary/40 ${
                          header.column.getIsResizing() ? "bg-primary" : ""
                        }`}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 group">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="px-3 py-2.5 align-middle overflow-hidden"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "documento" : "documentos"}
        </div>
      </div>
    </div>
  );
}
