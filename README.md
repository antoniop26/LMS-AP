# LMS-AP — Sistema de Gestión de Aprendizaje

MVP de LMS para **un solo colegio** (Colegio San Marcos).  
Stack: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Prisma + PostgreSQL (Supabase) + Supabase Auth/Storage.

Interfaz en **español**, diseño azul / blanco / gris, responsive.

## Roles

| Rol | Capacidades |
|-----|-------------|
| **Administrador** | Grados, grupos, asignaturas, usuarios, asignar profesores↔asignaturas y alumnos↔grupos |
| **Profesor** | Subir materiales (PDF/imágenes/docs), crear exámenes (opción múltiple, corta, larga), calificar |
| **Alumno** | Ver/subir materiales, presentar exámenes, ver calificaciones |

## Requisitos

- Node.js 18+ (recomendado 20)
- Cuenta gratuita en [Supabase](https://supabase.com)

## 1. Configurar Supabase (plan Free)

1. Cree un proyecto en https://supabase.com → **New project**.
2. En **Settings → API** copie:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (**nunca** en el cliente)
3. En **Settings → Database** copie la **Connection string** (URI).  
   - Para Prisma con pooler (Transaction): puerto `6543` y `?pgbouncer=true`  
   - Ejemplo:  
     `postgresql://postgres.XXXX:PASSWORD@aws-0-....pooler.supabase.com:6543/postgres?pgbouncer=true`
4. En **Authentication → Providers** deje Email habilitado.  
   Desactive “Confirm email” en desarrollo (Authentication → Providers → Email) para facilitar el seed.
5. **Storage**: cree un bucket público llamado `materiales`:
   - Storage → New bucket → nombre `materiales` → Public bucket.
   - Políticas sugeridas (SQL Editor):

```sql
-- Lectura pública
create policy "Lectura materiales"
on storage.objects for select
using (bucket_id = 'materiales');

-- Subida autenticados
create policy "Subida materiales"
on storage.objects for insert
to authenticated
with check (bucket_id = 'materiales');

-- Borrado autenticados (propio path o admin vía app)
create policy "Borrado materiales"
on storage.objects for delete
to authenticated
using (bucket_id = 'materiales');
```

## 2. Instalar y configurar el proyecto

```bash
cd LMS-AP
cp .env.example .env
# Edite .env con sus valores reales de Supabase
npm install
```

## 3. Migrar y sembrar la base de datos

```bash
npx prisma db push
# o: npx prisma migrate dev --name init

npm run db:seed
```

El seed crea:

- Colegio **San Marcos**
- Grados, grupos, asignaturas de ejemplo
- Examen de práctica en Matemáticas
- Usuarios (Auth + Prisma):

| Correo | Contraseña | Rol |
|--------|------------|-----|
| admin@colegio.demo | demo1234 | Administrador |
| profesor@colegio.demo | demo1234 | Profesor |
| alumno@colegio.demo | demo1234 | Alumno |

## 4. Ejecutar

```bash
npm run dev
```

Abra http://localhost:3000 e inicie sesión con una cuenta demo.

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run db:push` | Sincronizar esquema Prisma → DB |
| `npm run db:migrate` | Migraciones Prisma |
| `npm run db:seed` | Datos demo |
| `npx prisma studio` | Explorador visual de la DB |

## Estructura relevante

```
prisma/schema.prisma   # Modelo completo
prisma/seed.ts         # Seed Colegio San Marcos
src/lib/auth.ts        # Sesión + roles
src/lib/storage.ts     # Helpers Supabase Storage
src/lib/supabase/      # Clientes browser / server / middleware
src/app/(dashboard)/   # Paneles por rol
src/app/api/           # API REST del MVP
```

## Comunicados escolares

El administrador publica mensajes, flyers (imagen/PDF) y enlaces desde `/admin`.
Profesores y alumnos los ven en `/profesor` y `/alumno`.

Los flyers se suben al bucket existente `materiales` bajo
`announcements/{schoolId}/…` (mismas políticas de Storage; no hace falta un bucket `anuncios`).

API: `GET/POST /api/anuncios`, `DELETE /api/anuncios/[id]` (POST/DELETE solo ADMIN).

## Notas / limitaciones (MVP)

- Un solo colegio (sin multi-tenant).
- Sin video, foros, SCORM ni pagos.
- Las respuestas largas requieren calificación manual del profesor.
- Opción múltiple y respuesta corta se auto-califican al enviar.
- Sin claves reales de Supabase el login y uploads no funcionan; el tipado/`tsc` sí puede validarse.

## Licencia

Uso interno educativo — Colegio San Marcos (demo).
