"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectorFormDialog } from "@/components/procesos/sector-form-dialog";
import {
  ClipboardList, Plus, Lock, AlertCircle, Loader2,
  GitBranch, FileText, LayoutGrid,
} from "lucide-react";

interface Sector {
  id: string;
  nombre: string;
  descripcion: string | null;
  privado: boolean;
  orden: number;
  count_flujogramas: number;
  count_instructivos: number;
  tiene_alerta: boolean;
}

interface Stats {
  sectores: number;
  flujogramas: number;
  instructivos: number;
  pendientes: number;
}

export default function ProcesosPage() {
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [stats, setStats] = useState<Stats>({ sectores: 0, flujogramas: 0, instructivos: 0, pendientes: 0 });
  const [loading, setLoading] = useState(true);
  const [userRol, setUserRol] = useState("lector");
  const [showSectorForm, setShowSectorForm] = useState(false);
  const [usuarios, setUsuarios] = useState<Array<{ id: string; nombre: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/procesos/sectores");
    const data = await res.json();
    const list: Sector[] = Array.isArray(data) ? data : [];
    setSectores(list);
    setStats({
      sectores: list.length,
      flujogramas: list.reduce((acc, s) => acc + (s.count_flujogramas ?? 0), 0),
      instructivos: list.reduce((acc, s) => acc + (s.count_instructivos ?? 0), 0),
      pendientes: list.filter((s) => s.tiene_alerta).length,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
      setUserRol(data?.rol ?? "lector");
    });
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre").then(({ data }) => {
      setUsuarios(data ?? []);
    });
  }, [load]);

  const isAdmin = userRol === "admin";

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Procesos"
        actions={isAdmin ? (
          <Button size="sm" onClick={() => setShowSectorForm(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Agregar sector
          </Button>
        ) : undefined}
      />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        {/* Header stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Sectores", value: stats.sectores, icon: LayoutGrid, cls: "" },
            { label: "Flujogramas", value: stats.flujogramas, icon: GitBranch, cls: "" },
            { label: "Instructivos", value: stats.instructivos, icon: FileText, cls: "" },
            { label: "Pendientes aprobación", value: stats.pendientes, icon: AlertCircle, cls: "text-amber-600", alert: stats.pendientes > 0 },
          ].map((s) => (
            <Card key={s.label} className={s.alert ? "border-amber-200" : ""}>
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-8 w-8 opacity-20 shrink-0 ${s.cls}`} />
                <div>
                  <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sector grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sectores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <ClipboardList className="h-10 w-10 opacity-30" />
            <p className="text-sm">No hay sectores configurados.</p>
            <p className="text-xs">Ejecutá la migración SQL y los sectores por defecto aparecerán acá.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sectores.map((sector) => (
              <Link key={sector.id} href={`/procesos/${sector.id}`}>
                <Card className={`h-full transition-all hover:shadow-md cursor-pointer ${
                  sector.tiene_alerta
                    ? "border-amber-200 bg-amber-50/30"
                    : "hover:border-primary/30"
                }`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm truncate">{sector.nombre}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {sector.privado && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            <Lock className="h-2.5 w-2.5" />PRIVADO
                          </span>
                        )}
                        {sector.tiene_alerta && (
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-1">
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {sector.count_flujogramas} flujograma{sector.count_flujogramas !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {sector.count_instructivos} instructivo{sector.count_instructivos !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {sector.descripcion && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{sector.descripcion}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SectorFormDialog
        open={showSectorForm}
        onOpenChange={setShowSectorForm}
        onSuccess={load}
        usuarios={usuarios}
      />
    </div>
  );
}
