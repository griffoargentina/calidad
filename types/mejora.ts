export interface MejoraFoto {
  id: string;
  mejora_id: string;
  tipo: "antes" | "despues";
  storage_path: string;
  nombre_archivo: string;
  url: string;
  subido_at: string;
  subido_by: string | null;
}

export interface Mejora {
  id: string;
  numero: string;
  titulo: string;
  sector: string;
  maquina_equipo: string | null;
  area_oportunidad: string | null;
  situacion_antes: string | null;
  situacion_despues: string | null;
  accion_tomada: string | null;
  causa_descripcion: string | null;
  resultado_cambio: string | null;
  responsable_nombre: string | null;
  fecha_implementacion: string | null;
  estado: "en_proceso" | "implementada";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MejoraConFotos extends Mejora {
  fotos: MejoraFoto[];
  creador?: { id: string; nombre: string } | null;
}

export const SECTORES = [
  "Corte",
  "Costura",
  "Terminación",
  "Bordado",
  "Depósito",
  "Mantenimiento",
  "Administración",
  "Calidad",
  "Diseño",
] as const;

export type Sector = (typeof SECTORES)[number];

export const AREAS_OPORTUNIDAD = [
  "Seguridad / HSE",
  "Calidad",
  "Orden y limpieza (5S)",
  "Ergonomía",
  "Productividad / Flujo",
  "Trazabilidad",
  "Mantenimiento",
  "Capacitación",
  "Medio ambiente",
  "Otro",
] as const;
