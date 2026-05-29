"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProcedimientosTab } from "./procedimientos-tab";
import { EquiposTab } from "./equipos-tab";

interface Procedimiento {
  id: string;
  titulo: string;
  descripcion: string | null;
  archivo_url: string | null;
  archivo_nombre: string | null;
  created_at: string;
  updated_at: string;
}

interface Calibracion {
  id: string;
  equipo_id: string;
  fecha_calibracion: string;
  fecha_vencimiento: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  observaciones: string | null;
  created_at: string;
}

interface Equipo {
  id: string;
  nombre: string;
  codigo: string | null;
  rango_max: string | null;
  identificacion_serie: string | null;
  tipo: string | null;
  procedimiento_id: string | null;
  lugar_uso: string | null;
  frecuencia: string | null;
  activo: boolean;
  created_at: string;
  procedimiento: { id: string; titulo: string } | null;
  ultima_calibracion: Calibracion | null;
}

interface Props {
  procedimientosIniciales: Procedimiento[];
  equiposIniciales: Equipo[];
  canEdit: boolean;
}

export function CalibracionTabs({ procedimientosIniciales, equiposIniciales, canEdit }: Props) {
  return (
    <Tabs defaultValue="equipos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="equipos">Equipos de medición</TabsTrigger>
        <TabsTrigger value="procedimientos">Procedimientos</TabsTrigger>
      </TabsList>
      <TabsContent value="equipos">
        <EquiposTab equiposIniciales={equiposIniciales} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="procedimientos">
        <ProcedimientosTab procedimientosIniciales={procedimientosIniciales} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}
