-- =====================================================================
-- 001_pilot_rls_hardening.sql  (idempotente)
--
-- Contexto: la app accede a Postgres SOLO vía Prisma con el rol `postgres`
-- (dueño de las tablas, ignora RLS). El navegador solo usa Supabase para
-- Auth y Storage. La API REST de Supabase (PostgREST) NO se usa, pero antes
-- de este script exponía todas las tablas a los roles `anon`/`authenticated`
-- con la anon key pública (lectura y escritura sin RLS).
--
-- Estrategia (defense-in-depth):
--  1. ENABLE RLS en todas las tablas de `public` SIN políticas permisivas
--     → deny-all para anon/authenticated (postgres/service_role no afectados).
--  2. REVOKE de todos los privilegios de anon/authenticated en `public`
--     y en los privilegios por defecto (tablas futuras de `prisma db push`).
--  3. Storage: bucket `materiales` privado; descargas vía /api/archivos/*
--     (autoriza en servidor + URL firmada). Subidas solo dentro de la
--     carpeta del colegio del usuario; borrado solo del propio archivo.
-- =====================================================================

BEGIN;

-- 1) RLS en todas las tablas de public
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 2) Sin acceso directo para anon/authenticated
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Helper privado (no expuesto por PostgREST) para políticas de Storage.
CREATE SCHEMA IF NOT EXISTS lms_private;
REVOKE ALL ON SCHEMA lms_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA lms_private TO authenticated;

CREATE OR REPLACE FUNCTION lms_private.current_school_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "schoolId" FROM public."User" WHERE "supabaseId" = auth.uid()::text LIMIT 1
$$;
CREATE OR REPLACE FUNCTION lms_private.current_role_name()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public."User" WHERE "supabaseId" = auth.uid()::text LIMIT 1
$$;
REVOKE ALL ON FUNCTION lms_private.current_school_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lms_private.current_role_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lms_private.current_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION lms_private.current_role_name() TO authenticated;

-- 3) Storage
UPDATE storage.buckets SET public = false, file_size_limit = 20971520 WHERE id = 'materiales';

DROP POLICY IF EXISTS "Lectura materiales" ON storage.objects;
DROP POLICY IF EXISTS "Subida materiales"  ON storage.objects;
DROP POLICY IF EXISTS "Borrado materiales" ON storage.objects;
DROP POLICY IF EXISTS "materiales_insert_own_school" ON storage.objects;
DROP POLICY IF EXISTS "materiales_delete_own"        ON storage.objects;

-- Subida: <schoolId>/... (materiales) o announcements/<schoolId>/... (solo admin)
CREATE POLICY "materiales_insert_own_school" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'materiales'
    AND lms_private.current_school_id() IS NOT NULL
    AND (
      (storage.foldername(name))[1] = lms_private.current_school_id()
      OR (
        (storage.foldername(name))[1] = 'announcements'
        AND (storage.foldername(name))[2] = lms_private.current_school_id()
        AND lms_private.current_role_name() = 'ADMINISTRADOR'
      )
    )
  );

-- Borrado: solo el dueño del objeto (el servidor borra con service role).
CREATE POLICY "materiales_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'materiales' AND owner_id = auth.uid()::text);

-- Sin política SELECT: lectura solo con URL firmada generada en servidor.

COMMIT;
