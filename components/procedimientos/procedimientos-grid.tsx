"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertTriangle, XCircle, ClipboardList, Plus, Loader2 } from "lucide-react";

interface SectorStats {
  total: number;
  vencidos: number;
  porVencer: number;
}

interface Sector {
  id: string;
  nombre: string;
  descripcion: string | null;
  stats: SectorStats;
}

interface Props {
  sectores: Sector[];
  isAdmin: boolean;
}

function getSemaforo(stats: SectorStats): "verde" | "amarillo" | "rojo" {
  if (stats.total === 0) return "rojo";
  if (stats.vencidos > 0) return "rojo";
  if (stats.porVencer > 0) return "amarillo";
  return "verde";
}

export function ProcedimientosGrid({ sectores: initialSectores, isAdmin }: Props) {
  const [sectores, setSectores] = useState<Sector[]>(initialSectores);
  const [addDialog, setAddDialog] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleAddSector() {
    if (!newNombre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/procedimientos/sectores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newNombre.trim(), descripcion: newDesc.trim() || null }),
      });
      const data = await res.json();
      if (data.id) {
        setSectores((prev) => [...prev, data]);
        setAddDialog(false);
        setNewNombre("");
        setNewDesc("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> Todo vigente</span>
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-yellow-500" /> Por vencer</span>
          <span className="flex items-center gap-1.5"><XCircle className="h-4 w-4 text-red-500" /> Vencido o sin revisión</span>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setAddDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Agregar sector
          </Button>
        )}
      </div>

      {sectores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <ClipboardList className="h-10 w-10 opacity-30" />
          <p className="text-sm">No hay sectores configurados.</p>
          <p className="text-xs">Ejecutá la migración SQL y los 9 sectores por defecto aparecerán acá.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sectores.map((sector) => {
            const semaforo = getSemaforo(sector.stats);
            return (
              <Link key={sector.id} href={`/procedimientos/${sector.id}`}>
                <Card className={`h-full transition-all hover:shadow-md cursor-pointer ${
                  semaforo === "rojo"     ? "border-red-200 bg-red-50/40" :
                  semaforo === "amarillo" ? "border-yellow-200 bg-yellow-50/40" :
                  "border-green-200 bg-green-50/20"
                }`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm">{sector.nombre}</span>
                      </div>
                      {semaforo === "verde"    && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {semaforo === "amarillo" && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                      {semaforo === "rojo"     && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {sector.stats.total === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin procedimientos</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="text-muted-foreground">{sector.stats.total} procedimiento{sector.stats.total !== 1 ? "s" : ""}</span>
                        {sector.stats.vencidos > 0 && (
                          <span className="text-red-600 font-medium">{sector.stats.vencidos} vencido{sector.stats.vencidos !== 1 ? "s" : ""}</span>
                        )}
                        {sector.stats.porVencer > 0 && (
                          <span className="text-yellow-600">{sector.stats.porVencer} por vencer</span>
                        )}
                      </div>
                    )}
                    {sector.descripcion && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{sector.descripcion}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo sector</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                className="mt-1"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Ej: Seguridad"
                onKeyDown={(e) => e.key === "Enter" && handleAddSector()}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input
                className="mt-1"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddSector} disabled={saving || !newNombre.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
