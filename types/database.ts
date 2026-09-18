export type RolUsuario = "admin" | "editor" | "lector";

export type TipoItem =
  | "analisis_contexto"
  | "partes_interesadas"
  | "alcance_sgc"
  | "mapa_procesos"
  | "politica"
  | "roles_responsabilidades"
  | "riesgos_oportunidades"
  | "objetivo"
  | "indicador"
  | "infraestructura"
  | "instrumento"
  | "competencia"
  | "capacitacion"
  | "procedimiento"
  | "instructivo"
  | "formulario"
  | "registro"
  | "manual"
  | "diseno_desarrollo"
  | "evaluacion_proveedor"
  | "producto_no_conforme"
  | "satisfaccion_cliente"
  | "auditoria_interna"
  | "revision_direccion"
  | "no_conformidad"
  | "accion_correctiva"
  | "mejora"
  | "flujograma";

export type EstadoItem =
  | "vigente"
  | "por_vencer"
  | "vencido"
  | "obsoleto"
  | "pendiente_aprobacion"
  | "borrador";

export type AccionHistorial =
  | "alta"
  | "edicion"
  | "descarga"
  | "renovacion"
  | "aprobacion"
  | "rechazo"
  | "importacion_masiva";

export type TipoNotificacion =
  | "60d"
  | "30d"
  | "15d"
  | "7d"
  | "0d"
  | "post_vencimiento"
  | "asignacion"
  | "aprobacion"
  | "resumen_semanal";

export type EstadoNotificacion = "enviada" | "fallida";

export interface Area {
  id: string;
  nombre: string;
  descripcion: string | null;
  responsable_id: string | null;
  activa: boolean;
  created_at: string;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  area_id: string | null;
  tipos_habilitados: TipoItem[];
  activo: boolean;
  ultimo_login: string | null;
  preferencia_codigo: "corto" | "completo";
  created_at: string;
}

export interface ClausulaISO {
  id: string;
  titulo: string;
  descripcion: string | null;
}

export interface Item {
  id: string;
  codigo: string;
  codigo_completo: string;
  tipo: TipoItem;
  clausula_iso: string;
  area_id: string | null;
  responsable_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  frecuencia_dias: number | null;
  estado: EstadoItem;
  requiere_aprobacion: boolean;
  version_actual: number;
  codigo_formal: string | null;
  etiquetas: string[];
  es_borrador: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Archivo {
  id: string;
  item_id: string;
  version: number;
  archivo_url: string;
  nombre_archivo: string;
  tamaño_bytes: number | null;
  subido_por: string | null;
  subido_at: string;
  comentario: string | null;
  aprobado_por: string | null;
  aprobado_at: string | null;
}

export interface Historial {
  id: string;
  item_id: string;
  accion: AccionHistorial;
  usuario_id: string | null;
  detalle: Record<string, unknown>;
  created_at: string;
}

export interface Notificacion {
  id: string;
  item_id: string | null;
  tipo: TipoNotificacion;
  destinatario_id: string;
  enviada_at: string;
  estado: EstadoNotificacion;
}

export interface Comentario {
  id: string;
  item_id: string;
  usuario_id: string;
  contenido: string;
  created_at: string;
}

export interface Plantilla {
  id: string;
  nombre: string;
  tipo: TipoItem;
  valores_default: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

// Joined types for common queries
export interface ItemConRelaciones extends Item {
  area?: Area;
  responsable?: Usuario;
  clausula?: ClausulaISO;
  archivos?: Archivo[];
  comentarios?: Comentario[];
}

export interface ArchivoConUsuario extends Archivo {
  subido_por_usuario?: Usuario;
  aprobado_por_usuario?: Usuario;
}

export interface ComentarioConUsuario extends Comentario {
  usuario?: Usuario;
}

export interface HistorialConUsuario extends Historial {
  usuario?: Usuario;
  item?: Item;
}
