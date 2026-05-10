-- ============================================================
-- QMS Griffo — Migración inicial
-- ISO 9001:2015 Document Management System
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda full-text

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE rol_usuario AS ENUM ('admin', 'editor', 'lector');

CREATE TYPE tipo_item AS ENUM (
  'analisis_contexto',
  'partes_interesadas',
  'alcance_sgc',
  'mapa_procesos',
  'politica',
  'roles_responsabilidades',
  'riesgos_oportunidades',
  'objetivo',
  'indicador',
  'infraestructura',
  'instrumento',
  'competencia',
  'capacitacion',
  'procedimiento',
  'instructivo',
  'formulario',
  'registro',
  'manual',
  'diseno_plan',
  'diseno_entrada',
  'diseno_revision',
  'diseno_salida',
  'diseno_cambio',
  'evaluacion_proveedor',
  'producto_no_conforme',
  'satisfaccion_cliente',
  'auditoria_interna',
  'revision_direccion',
  'no_conformidad',
  'accion_correctiva',
  'mejora'
);

CREATE TYPE estado_item AS ENUM (
  'vigente',
  'por_vencer',
  'vencido',
  'obsoleto',
  'pendiente_aprobacion',
  'borrador'
);

CREATE TYPE accion_historial AS ENUM (
  'alta',
  'edicion',
  'descarga',
  'renovacion',
  'aprobacion',
  'rechazo',
  'importacion_masiva'
);

CREATE TYPE tipo_notificacion AS ENUM (
  '60d',
  '30d',
  '15d',
  '7d',
  '0d',
  'post_vencimiento',
  'asignacion',
  'aprobacion',
  'resumen_semanal'
);

CREATE TYPE estado_notificacion AS ENUM ('enviada', 'fallida');

CREATE TYPE preferencia_codigo AS ENUM ('corto', 'completo');

-- ============================================================
-- TABLA: areas
-- ============================================================

CREATE TABLE areas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  responsable_id UUID, -- FK se agrega luego (después de usuarios)
  activa      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: usuarios
-- Extiende auth.users de Supabase con datos de perfil
-- ============================================================

CREATE TABLE usuarios (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL UNIQUE,
  nombre            TEXT NOT NULL,
  rol               rol_usuario NOT NULL DEFAULT 'lector',
  area_id           UUID REFERENCES areas(id) ON DELETE SET NULL,
  tipos_habilitados tipo_item[] NOT NULL DEFAULT '{}',
  activo            BOOLEAN NOT NULL DEFAULT true,
  ultimo_login      TIMESTAMPTZ,
  preferencia_codigo preferencia_codigo NOT NULL DEFAULT 'corto',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ahora agregamos la FK de areas.responsable_id
ALTER TABLE areas
  ADD CONSTRAINT fk_areas_responsable
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ============================================================
-- TABLA: clausulas_iso
-- Precargada con las 33 cláusulas auditables de ISO 9001:2015
-- ============================================================

CREATE TABLE clausulas_iso (
  id          TEXT PRIMARY KEY, -- ej. "7.1.5"
  titulo      TEXT NOT NULL,
  descripcion TEXT
);

-- ============================================================
-- TABLA: items (núcleo del sistema)
-- ============================================================

-- Secuencias por tipo para códigos autogenerados
CREATE SEQUENCE IF NOT EXISTS seq_item_codigo;

CREATE TABLE items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo              TEXT NOT NULL UNIQUE,          -- ej. "INS-015"
  codigo_completo     TEXT NOT NULL,                 -- ej. "7.1.5-INS-015" (generado por trigger)
  tipo                tipo_item NOT NULL,
  clausula_iso        TEXT NOT NULL REFERENCES clausulas_iso(id),
  area_id             UUID REFERENCES areas(id) ON DELETE SET NULL,
  responsable_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo              TEXT NOT NULL,
  descripcion         TEXT,
  fecha_emision       DATE,
  fecha_vencimiento   DATE,
  frecuencia_dias     INTEGER CHECK (frecuencia_dias IS NULL OR frecuencia_dias > 0),
  estado              estado_item NOT NULL DEFAULT 'borrador',
  requiere_aprobacion BOOLEAN NOT NULL DEFAULT false,
  version_actual      INTEGER NOT NULL DEFAULT 1,
  etiquetas           TEXT[] NOT NULL DEFAULT '{}',
  es_borrador         BOOLEAN NOT NULL DEFAULT false,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: archivos
-- Versionado inmutable: nunca se borra, solo se agrega
-- ============================================================

CREATE TABLE archivos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  archivo_url     TEXT NOT NULL,
  nombre_archivo  TEXT NOT NULL,
  tamaño_bytes    BIGINT,
  subido_por      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  subido_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comentario      TEXT,
  aprobado_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  aprobado_at     TIMESTAMPTZ,
  UNIQUE (item_id, version)
);

-- ============================================================
-- TABLA: historial
-- Log completo de auditoría — inmutable
-- ============================================================

CREATE TABLE historial (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id     UUID REFERENCES items(id) ON DELETE SET NULL,
  accion      accion_historial NOT NULL,
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  detalle     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: notificaciones
-- Registro de mails enviados — evidencia y deduplicación
-- ============================================================

CREATE TABLE notificaciones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id         UUID REFERENCES items(id) ON DELETE SET NULL,
  tipo            tipo_notificacion NOT NULL,
  destinatario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  enviada_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado          estado_notificacion NOT NULL DEFAULT 'enviada'
);

-- ============================================================
-- TABLA: comentarios
-- Discusión auditada por item
-- ============================================================

CREATE TABLE comentarios (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  contenido   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: plantillas
-- Templates reutilizables para crear items
-- ============================================================

CREATE TABLE plantillas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre          TEXT NOT NULL,
  tipo            tipo_item NOT NULL,
  valores_default JSONB NOT NULL DEFAULT '{}',
  created_by      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- items — los más consultados
CREATE INDEX idx_items_tipo ON items(tipo);
CREATE INDEX idx_items_clausula_iso ON items(clausula_iso);
CREATE INDEX idx_items_area_id ON items(area_id);
CREATE INDEX idx_items_responsable_id ON items(responsable_id);
CREATE INDEX idx_items_estado ON items(estado);
CREATE INDEX idx_items_fecha_vencimiento ON items(fecha_vencimiento) WHERE fecha_vencimiento IS NOT NULL;
CREATE INDEX idx_items_es_borrador ON items(es_borrador);
CREATE INDEX idx_items_etiquetas ON items USING gin(etiquetas);
CREATE INDEX idx_items_updated_at ON items(updated_at DESC);

-- Búsqueda full-text en items
CREATE INDEX idx_items_titulo_trgm ON items USING gin(titulo gin_trgm_ops);
CREATE INDEX idx_items_descripcion_trgm ON items USING gin(descripcion gin_trgm_ops) WHERE descripcion IS NOT NULL;

-- archivos
CREATE INDEX idx_archivos_item_id ON archivos(item_id);
CREATE INDEX idx_archivos_item_version ON archivos(item_id, version DESC);

-- historial
CREATE INDEX idx_historial_item_id ON historial(item_id);
CREATE INDEX idx_historial_usuario_id ON historial(usuario_id);
CREATE INDEX idx_historial_created_at ON historial(created_at DESC);
CREATE INDEX idx_historial_accion ON historial(accion);

-- notificaciones
CREATE INDEX idx_notificaciones_item_id ON notificaciones(item_id);
CREATE INDEX idx_notificaciones_destinatario_id ON notificaciones(destinatario_id);
CREATE INDEX idx_notificaciones_tipo_enviada ON notificaciones(tipo, enviada_at DESC);

-- comentarios
CREATE INDEX idx_comentarios_item_id ON comentarios(item_id);

-- usuarios
CREATE INDEX idx_usuarios_area_id ON usuarios(area_id);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
