-- ============================================================
-- QMS Griffo — Seed: Cláusulas ISO 9001:2015
-- Las 33 cláusulas auditables del estándar
-- ============================================================

INSERT INTO clausulas_iso (id, titulo, descripcion) VALUES
  ('4.1',   'Comprensión de la organización y de su contexto',
   'La organización debe determinar las cuestiones externas e internas que son pertinentes para su propósito y que afectan a su capacidad para lograr los resultados previstos de su SGC.'),

  ('4.2',   'Comprensión de las necesidades y expectativas de las partes interesadas',
   'La organización debe determinar las partes interesadas pertinentes al SGC y los requisitos pertinentes de esas partes interesadas.'),

  ('4.3',   'Determinación del alcance del sistema de gestión de la calidad',
   'La organización debe determinar los límites y la aplicabilidad del SGC para establecer su alcance.'),

  ('4.4',   'Sistema de gestión de la calidad y sus procesos',
   'La organización debe establecer, implementar, mantener y mejorar continuamente el SGC, incluyendo los procesos necesarios y sus interacciones.'),

  ('5.1',   'Liderazgo y compromiso',
   'La alta dirección debe demostrar liderazgo y compromiso con respecto al SGC.'),

  ('5.2',   'Política',
   'La alta dirección debe establecer, implementar y mantener una política de la calidad.'),

  ('5.3',   'Roles, responsabilidades y autoridades en la organización',
   'La alta dirección debe asegurarse de que las responsabilidades y autoridades para los roles pertinentes se asignen, se comuniquen y se entiendan.'),

  ('6.1',   'Acciones para abordar riesgos y oportunidades',
   'Al planificar el SGC, la organización debe considerar las cuestiones del contexto y los requisitos de las partes interesadas, y determinar los riesgos y oportunidades.'),

  ('6.2',   'Objetivos de la calidad y planificación para lograrlos',
   'La organización debe establecer objetivos de la calidad para las funciones y niveles pertinentes.'),

  ('6.3',   'Planificación de los cambios',
   'Cuando la organización determine la necesidad de cambios en el SGC, estos cambios se deben llevar a cabo de manera planificada.'),

  ('7.1.1', 'Generalidades de recursos',
   'La organización debe determinar y proporcionar los recursos necesarios para el establecimiento, implementación, mantenimiento y mejora continua del SGC.'),

  ('7.1.2', 'Personas',
   'La organización debe determinar y proporcionar las personas necesarias para la implementación eficaz de su SGC.'),

  ('7.1.3', 'Infraestructura',
   'La organización debe determinar, proporcionar y mantener la infraestructura necesaria para la operación de sus procesos.'),

  ('7.1.4', 'Ambiente para la operación de los procesos',
   'La organización debe determinar, proporcionar y mantener el ambiente necesario para la operación de sus procesos.'),

  ('7.1.5', 'Recursos de seguimiento y medición',
   'La organización debe determinar y proporcionar los recursos necesarios para asegurarse de la validez y fiabilidad de los resultados cuando se realice seguimiento o medición.'),

  ('7.1.6', 'Conocimientos de la organización',
   'La organización debe determinar los conocimientos necesarios para la operación de sus procesos y para lograr la conformidad de los productos y servicios.'),

  ('7.2',   'Competencia',
   'La organización debe determinar la competencia necesaria de las personas que realizan trabajo bajo su control que afecta al desempeño y eficacia del SGC.'),

  ('7.3',   'Toma de conciencia',
   'La organización debe asegurarse de que las personas que realizan el trabajo bajo el control de la organización tomen conciencia de la política de la calidad y los objetivos pertinentes.'),

  ('7.4',   'Comunicación',
   'La organización debe determinar las comunicaciones internas y externas pertinentes al SGC.'),

  ('7.5',   'Información documentada',
   'El SGC de la organización debe incluir la información documentada requerida por la Norma Internacional y la determinada por la organización como necesaria.'),

  ('8.1',   'Planificación y control operacional',
   'La organización debe planificar, implementar, controlar, hacer seguimiento y revisar los procesos necesarios para cumplir los requisitos para la provisión de productos y servicios.'),

  ('8.2',   'Requisitos para los productos y servicios',
   'La organización debe asegurarse de que está en condiciones de cumplir los requisitos de los productos y servicios que se van a ofrecer a los clientes.'),

  ('8.3',   'Diseño y desarrollo de los productos y servicios',
   'La organización debe establecer, implementar y mantener un proceso de diseño y desarrollo que sea adecuado para asegurarse de la posterior provisión de productos y servicios.'),

  ('8.4',   'Control de los procesos, productos y servicios suministrados externamente',
   'La organización debe asegurarse de que los procesos, productos y servicios suministrados externamente son conformes a los requisitos.'),

  ('8.5',   'Producción y provisión del servicio',
   'La organización debe implementar la producción y provisión del servicio bajo condiciones controladas.'),

  ('8.6',   'Liberación de los productos y servicios',
   'La organización debe implementar las disposiciones planificadas para verificar que se cumplen los requisitos de los productos y servicios.'),

  ('8.7',   'Control de las salidas no conformes',
   'La organización debe asegurarse de que las salidas que no sean conformes con sus requisitos se identifican y se controlan para prevenir su uso o entrega no intencionados.'),

  ('9.1.1', 'Generalidades de seguimiento, medición, análisis y evaluación',
   'La organización debe determinar qué necesita seguimiento y medición, los métodos de análisis y evaluación necesarios.'),

  ('9.1.2', 'Satisfacción del cliente',
   'La organización debe realizar el seguimiento de las percepciones de los clientes del grado en que se cumplen sus necesidades y expectativas.'),

  ('9.1.3', 'Análisis y evaluación',
   'La organización debe analizar y evaluar los datos e información apropiados que surgen del seguimiento y la medición.'),

  ('9.2',   'Auditoría interna',
   'La organización debe llevar a cabo auditorías internas a intervalos planificados para proporcionar información acerca de si el SGC es conforme con los requisitos.'),

  ('9.3',   'Revisión por la dirección',
   'La alta dirección debe revisar el SGC de la organización a intervalos planificados para asegurarse de su conveniencia, adecuación, eficacia y alineación continua.'),

  ('10.2',  'No conformidad y acción correctiva',
   'Cuando ocurra una no conformidad, la organización debe reaccionar, tomar acciones para controlarla y corregirla, y hacer frente a las consecuencias.'),

  ('10.3',  'Mejora continua',
   'La organización debe mejorar continuamente la conveniencia, adecuación y eficacia del SGC.')

ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion;
