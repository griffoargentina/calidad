-- 007_seed_usuarios.sql
-- Agrega áreas faltantes y crea los 7 usuarios del equipo Griffo.
-- Los usuarios se crean con contraseña temporal. El admin debe enviar
-- "Reset password" desde el panel de Supabase Auth para que cada uno active su cuenta.

-- 1. Áreas nuevas
INSERT INTO areas (nombre, activa)
SELECT nombre, true FROM (VALUES
  ('Sistemas'),
  ('Programación')
) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM areas WHERE areas.nombre = v.nombre);

-- 2. Crear usuarios en auth.users (confirmados, contraseña temporal GriffoQMS2025!)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  v.email,
  crypt('GriffoQMS2025!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false
FROM (VALUES
  ('produccion@griffo.com.ar'),
  ('calidad@griffo.com.ar'),
  ('jagriffo@griffo.com.ar'),
  ('compras@griffo.com.ar'),
  ('dgriffo@griffo.com.ar'),
  ('ppirillo@griffo.com.ar'),
  ('jgriffo@griffo.com.ar')
) AS v(email)
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = v.email);

-- 3. Crear registros en public.usuarios
INSERT INTO usuarios (id, nombre, rol, area_id)
SELECT
  u.id,
  v.nombre,
  v.rol::text,
  a.id
FROM auth.users u
JOIN (VALUES
  ('produccion@griffo.com.ar', 'Sergio Rodriguez', 'editor',  'Producción'),
  ('calidad@griffo.com.ar',    'Walter Riccelli',  'editor',  'Calidad'),
  ('jagriffo@griffo.com.ar',   'Javier Griffo',    'editor',  'Programación'),
  ('compras@griffo.com.ar',    'Gustavo Nardi',    'editor',  'Compras'),
  ('dgriffo@griffo.com.ar',    'Diego Griffo',     'admin',   'Diseño'),
  ('ppirillo@griffo.com.ar',   'Pablo Pirillo',    'editor',  'Sistemas'),
  ('jgriffo@griffo.com.ar',    'Jose Griffo',      'editor',  'Comercial')
) AS v(email, nombre, rol, area_nombre) ON u.email = v.email
JOIN areas a ON a.nombre = v.area_nombre
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = u.id);
