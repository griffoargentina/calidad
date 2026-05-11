import { TipoItem } from "@/types/database";

export interface RequisitoISO {
  id: string;
  descripcion: string;
  tipo_item?: TipoItem; // tipo de documento que provee evidencia
  nota?: string;
}

export const CLAUSULA_REQUISITOS: Record<string, RequisitoISO[]> = {
  "4.1": [
    { id: "4.1-a", descripcion: "Cuestiones externas relevantes determinadas (políticas, económicas, sociales, tecnológicas, ambientales, legales)", tipo_item: "analisis_contexto" },
    { id: "4.1-b", descripcion: "Cuestiones internas relevantes determinadas (cultura, valores, desempeño, recursos, capacidades)", tipo_item: "analisis_contexto" },
    { id: "4.1-c", descripcion: "Seguimiento y revisión periódica del análisis de contexto", tipo_item: "analisis_contexto" },
  ],
  "4.2": [
    { id: "4.2-a", descripcion: "Partes interesadas pertinentes identificadas (clientes, distribuidores, mecánicos, proveedores, empleados, organismos reguladores)", tipo_item: "partes_interesadas" },
    { id: "4.2-b", descripcion: "Requisitos y expectativas de cada parte interesada determinados", tipo_item: "partes_interesadas" },
    { id: "4.2-c", descripcion: "Seguimiento y revisión periódica de partes interesadas", tipo_item: "partes_interesadas" },
  ],
  "4.3": [
    { id: "4.3-a", descripcion: "Alcance del SGC determinado y documentado", tipo_item: "alcance_sgc" },
    { id: "4.3-b", descripcion: "Límites y aplicabilidad del SGC definidos", tipo_item: "alcance_sgc" },
    { id: "4.3-c", descripcion: "Exclusiones justificadas (si aplica)", tipo_item: "alcance_sgc" },
  ],
  "4.4": [
    { id: "4.4-a", descripcion: "Mapa de procesos con entradas, salidas, secuencia e interacciones", tipo_item: "mapa_procesos" },
    { id: "4.4-b", descripcion: "Responsables asignados a cada proceso", tipo_item: "mapa_procesos" },
    { id: "4.4-c", descripcion: "Riesgos y oportunidades considerados por proceso", tipo_item: "mapa_procesos" },
    { id: "4.4-d", descripcion: "Indicadores de proceso definidos para seguimiento", tipo_item: "indicador" },
  ],
  "5.1": [
    { id: "5.1-a", descripcion: "Compromiso de la dirección evidenciado con la política y objetivos de calidad", tipo_item: "politica" },
    { id: "5.1-b", descripcion: "Enfoque al cliente: requisitos del cliente determinados y satisfacción medida", tipo_item: "satisfaccion_cliente" },
    { id: "5.1-c", descripcion: "Riesgos y oportunidades que afectan a la conformidad del producto determinados", tipo_item: "riesgos_oportunidades" },
  ],
  "5.2": [
    { id: "5.2-a", descripcion: "Política de calidad documentada, apropiada al propósito de la organización", tipo_item: "politica" },
    { id: "5.2-b", descripcion: "Política incluye compromiso de mejora continua y de cumplimiento de requisitos", tipo_item: "politica" },
    { id: "5.2-c", descripcion: "Política comunicada, entendida y disponible para las partes interesadas", tipo_item: "politica" },
  ],
  "5.3": [
    { id: "5.3-a", descripcion: "Roles, responsabilidades y autoridades asignados y comunicados", tipo_item: "roles_responsabilidades" },
    { id: "5.3-b", descripcion: "Responsable del SGC designado con autoridad suficiente", tipo_item: "roles_responsabilidades" },
  ],
  "6.1": [
    { id: "6.1-a", descripcion: "Riesgos y oportunidades determinados considerando el contexto y partes interesadas", tipo_item: "riesgos_oportunidades" },
    { id: "6.1-b", descripcion: "Acciones planificadas para abordar riesgos (eliminar, reducir, asumir)", tipo_item: "riesgos_oportunidades" },
    { id: "6.1-c", descripcion: "Eficacia de las acciones evaluada", tipo_item: "riesgos_oportunidades" },
  ],
  "6.2": [
    { id: "6.2-a", descripcion: "Objetivos de calidad establecidos, medibles y coherentes con la política", tipo_item: "objetivo" },
    { id: "6.2-b", descripcion: "Indicadores (KPIs) definidos para cada objetivo con meta y frecuencia de medición", tipo_item: "indicador" },
    { id: "6.2-c", descripcion: "Plan de acción para lograr objetivos documentado (responsable, plazo, recursos)", tipo_item: "objetivo" },
  ],
  "6.3": [
    { id: "6.3-a", descripcion: "Cambios en el SGC planificados y documentados de forma controlada", tipo_item: "procedimiento" },
  ],
  "7.1.1": [
    { id: "7.1.1-a", descripcion: "Recursos necesarios para el SGC determinados y disponibles", tipo_item: "infraestructura" },
    { id: "7.1.1-b", descripcion: "Capacidades y limitaciones de los recursos internos consideradas", tipo_item: "roles_responsabilidades" },
  ],
  "7.1.2": [
    { id: "7.1.2-a", descripcion: "Personas necesarias para la operación y control del SGC determinadas", tipo_item: "competencia" },
  ],
  "7.1.3": [
    { id: "7.1.3-a", descripcion: "Infraestructura requerida determinada y mantenida (edificios, equipos, transporte, TI)", tipo_item: "infraestructura" },
    { id: "7.1.3-b", descripcion: "Plan de mantenimiento preventivo de equipos e instalaciones", tipo_item: "infraestructura" },
  ],
  "7.1.4": [
    { id: "7.1.4-a", descripcion: "Ambiente necesario para la operación de procesos determinado (temperatura, limpieza, iluminación, etc.)", tipo_item: "procedimiento" },
  ],
  "7.1.5": [
    { id: "7.1.5-a", descripcion: "Instrumentos de medición y seguimiento identificados e inventariados", tipo_item: "instrumento" },
    { id: "7.1.5-b", descripcion: "Programa de calibración o verificación documentado para cada instrumento", tipo_item: "instrumento" },
    { id: "7.1.5-c", descripcion: "Certificados o registros de calibración vigentes por instrumento", tipo_item: "instrumento" },
    { id: "7.1.5-d", descripcion: "Instrumentos identificados con estado de calibración (etiqueta, código)", tipo_item: "instrumento" },
    { id: "7.1.5-e", descripcion: "Acciones tomadas cuando el instrumento no es apto para el uso previsto", tipo_item: "registro" },
  ],
  "7.1.6": [
    { id: "7.1.6-a", descripcion: "Conocimiento necesario para la operación de procesos y logro de conformidad determinado", tipo_item: "procedimiento" },
    { id: "7.1.6-b", descripcion: "Conocimiento organizacional mantenido y protegido (lecciones aprendidas, buenas prácticas)", tipo_item: "registro" },
  ],
  "7.2": [
    { id: "7.2-a", descripcion: "Competencias necesarias de personas que afectan el desempeño del SGC determinadas", tipo_item: "competencia" },
    { id: "7.2-b", descripcion: "Competencias aseguradas por educación, formación o experiencia", tipo_item: "capacitacion" },
    { id: "7.2-c", descripcion: "Acciones para adquirir competencias faltantes y evaluación de su eficacia", tipo_item: "capacitacion" },
    { id: "7.2-d", descripcion: "Registros de evidencia de competencia conservados", tipo_item: "registro" },
  ],
  "7.3": [
    { id: "7.3-a", descripcion: "Personal toma conciencia de la política de calidad y su contribución a los objetivos", tipo_item: "capacitacion" },
    { id: "7.3-b", descripcion: "Personal conoce las implicaciones del incumplimiento de los requisitos del SGC", tipo_item: "capacitacion" },
  ],
  "7.4": [
    { id: "7.4-a", descripcion: "Comunicaciones internas y externas relevantes para el SGC determinadas (qué, cuándo, a quién, cómo)", tipo_item: "procedimiento" },
  ],
  "7.5": [
    { id: "7.5-a", descripcion: "Procedimiento de control de documentos (creación, revisión, aprobación, distribución, retiro)", tipo_item: "procedimiento" },
    { id: "7.5-b", descripcion: "Procedimiento de control de registros (identificación, almacenamiento, protección, recuperación, retención, disposición)", tipo_item: "procedimiento" },
    { id: "7.5-c", descripcion: "Información documentada de origen externo identificada y controlada", tipo_item: "registro" },
    { id: "7.5-d", descripcion: "Manual de calidad u otro documento que describa el SGC (si la organización lo requiere)", tipo_item: "manual" },
  ],
  "8.1": [
    { id: "8.1-a", descripcion: "Procesos operacionales planificados, implementados y controlados", tipo_item: "procedimiento" },
    { id: "8.1-b", descripcion: "Criterios para los procesos y aceptación de productos/servicios documentados", tipo_item: "instructivo" },
    { id: "8.1-c", descripcion: "Información documentada necesaria para demostrar que los procesos se llevaron a cabo según lo planificado", tipo_item: "registro" },
  ],
  "8.2": [
    { id: "8.2-a", descripcion: "Proceso de comunicación con el cliente definido (consultas, pedidos, retroalimentación, quejas)", tipo_item: "procedimiento" },
    { id: "8.2-b", descripcion: "Requisitos del producto/servicio determinados y revisados antes de la aceptación del pedido", tipo_item: "registro" },
    { id: "8.2-c", descripcion: "Cambios en requisitos comunicados y registros actualizados", tipo_item: "registro" },
  ],
  "8.3": [
    { id: "8.3-a", descripcion: "Plan de diseño y desarrollo con etapas, revisiones, responsables", tipo_item: "diseno_plan" },
    { id: "8.3-b", descripcion: "Entradas de diseño documentadas (requisitos funcionales, legales, de clientes)", tipo_item: "diseno_entrada" },
    { id: "8.3-c", descripcion: "Revisiones de diseño realizadas y registradas", tipo_item: "diseno_revision" },
    { id: "8.3-d", descripcion: "Salidas de diseño verificadas y validadas contra las entradas", tipo_item: "diseno_salida" },
    { id: "8.3-e", descripcion: "Cambios de diseño controlados y sus efectos evaluados", tipo_item: "diseno_cambio" },
  ],
  "8.4": [
    { id: "8.4-a", descripcion: "Criterios de evaluación y selección de proveedores externos definidos", tipo_item: "evaluacion_proveedor" },
    { id: "8.4-b", descripcion: "Evaluación periódica de proveedores críticos documentada", tipo_item: "evaluacion_proveedor" },
    { id: "8.4-c", descripcion: "Requisitos comunicados a los proveedores (especificaciones, plazos, calidad)", tipo_item: "registro" },
  ],
  "8.5": [
    { id: "8.5-a", descripcion: "Condiciones controladas de producción/servicio: instrucciones de trabajo disponibles", tipo_item: "instructivo" },
    { id: "8.5-b", descripcion: "Identificación y trazabilidad del producto durante la producción y entrega", tipo_item: "registro" },
    { id: "8.5-c", descripcion: "Preservación del producto (embalaje, almacenamiento, manipulación) controlada", tipo_item: "procedimiento" },
  ],
  "8.6": [
    { id: "8.6-a", descripcion: "Inspección y ensayo de producto final antes de liberación documentado", tipo_item: "registro" },
    { id: "8.6-b", descripcion: "Criterios de aceptación del producto definidos", tipo_item: "instructivo" },
    { id: "8.6-c", descripcion: "Trazabilidad de la liberación: persona autorizada y fecha registradas", tipo_item: "registro" },
  ],
  "8.7": [
    { id: "8.7-a", descripcion: "Procedimiento para identificar y controlar productos no conformes", tipo_item: "producto_no_conforme" },
    { id: "8.7-b", descripcion: "Registros de productos no conformes con descripción, disposición adoptada y concesiones", tipo_item: "producto_no_conforme" },
  ],
  "9.1.1": [
    { id: "9.1.1-a", descripcion: "Métodos de seguimiento, medición, análisis y evaluación definidos", tipo_item: "indicador" },
    { id: "9.1.1-b", descripcion: "Resultados documentados y analizados periódicamente", tipo_item: "registro" },
  ],
  "9.1.2": [
    { id: "9.1.2-a", descripcion: "Método para obtener percepción del cliente sobre sus requisitos definido (encuestas, quejas, NPS)", tipo_item: "satisfaccion_cliente" },
    { id: "9.1.2-b", descripcion: "Resultados de satisfacción del cliente analizados y documentados", tipo_item: "satisfaccion_cliente" },
  ],
  "9.1.3": [
    { id: "9.1.3-a", descripcion: "Análisis de datos e indicadores del SGC (conformidad de productos, satisfacción, desempeño de proveedores)", tipo_item: "indicador" },
    { id: "9.1.3-b", descripcion: "Evaluación del desempeño y la eficacia del SGC documentada", tipo_item: "indicador" },
  ],
  "9.2": [
    { id: "9.2-a", descripcion: "Programa de auditorías internas planificado (frecuencia, alcance, criterios)", tipo_item: "auditoria_interna" },
    { id: "9.2-b", descripcion: "Auditores seleccionados garantizando objetividad e imparcialidad", tipo_item: "auditoria_interna" },
    { id: "9.2-c", descripcion: "Informes de auditoría interna con hallazgos y acciones correctivas documentados", tipo_item: "auditoria_interna" },
  ],
  "9.3": [
    { id: "9.3-a", descripcion: "Revisión por la dirección realizada con las entradas requeridas (auditorías, satisfacción, desempeño, acciones correctivas, riesgos)", tipo_item: "revision_direccion" },
    { id: "9.3-b", descripcion: "Acta de revisión por la dirección con decisiones y acciones acordadas documentada", tipo_item: "revision_direccion" },
  ],
  "10.2": [
    { id: "10.2-a", descripcion: "Procedimiento para tratar no conformidades y acciones correctivas", tipo_item: "no_conformidad" },
    { id: "10.2-b", descripcion: "Registros de no conformidades con causa raíz, acciones tomadas y verificación de eficacia", tipo_item: "accion_correctiva" },
    { id: "10.2-c", descripcion: "Actualización de riesgos y oportunidades derivada del análisis de no conformidades", tipo_item: "riesgos_oportunidades" },
  ],
  "10.3": [
    { id: "10.3-a", descripcion: "Oportunidades de mejora identificadas y gestionadas", tipo_item: "mejora" },
    { id: "10.3-b", descripcion: "Mejoras continuas al SGC documentadas y comunicadas a dirección", tipo_item: "mejora" },
  ],
};
