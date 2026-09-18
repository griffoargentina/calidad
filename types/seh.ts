export type SehAmbito = "seguridad_higiene" | "medio_ambiente";
export type SehTipoVencimiento = "fecha_fija" | "anual" | "periodico" | "sin_vencimiento" | "segun_plan";
export type SehEstado = "no_corresponde" | "completado" | "faltante" | "vencido" | "proximo_a_vencer" | "en_fecha";
export type SehTipoNotificacion = "por_vencer_30" | "por_vencer_7" | "informe_mensual";

export interface SehUbicacion {
  id: string;
  nombre: string;
  tipo: "fabrica" | "deposito" | "empresa";
  activo: boolean;
}

export interface SehRequisito {
  id: string;
  nombre: string;
  ambito: SehAmbito;
  ubicacion_id: string;
  norma: string | null;
  tipo_vencimiento: SehTipoVencimiento;
  periodicidad_meses: number | null;
  aplica: boolean;
  observacion_general: string | null;
  activo: boolean;
  orden: number;
  created_at: string;
  ubicacion?: SehUbicacion;
}

export interface SehCumplimiento {
  id: string;
  requisito_id: string;
  fecha_vencimiento: string | null;
  fecha_planificada: string | null;
  fecha_realizada: string | null;
  observacion: string | null;
  responsable_id: string | null;
  created_at: string;
  updated_at: string;
  archivos?: SehArchivo[];
}

export interface SehArchivo {
  id: string;
  cumplimiento_id: string;
  nombre_archivo: string;
  storage_path: string;
  subido_por: string | null;
  subido_at: string;
}

// Vista con estado calculado
export interface SehVEstado extends SehCumplimiento {
  nombre: string;
  ambito: SehAmbito;
  ubicacion_id: string;
  norma: string | null;
  tipo_vencimiento: SehTipoVencimiento;
  aplica: boolean;
  observacion_general: string | null;
  activo: boolean;
  orden: number;
  ubicacion_nombre: string;
  ubicacion_tipo: "fabrica" | "deposito" | "empresa";
  estado: SehEstado;
  dias_vencido: number | null;
  dias_hasta_vencimiento: number | null;
}
