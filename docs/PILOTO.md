# Piloto con colegio — Tigers LMS

Guía corta de seguridad y operación para el piloto en https://lms-ap.vercel.app.

## 1. Cuentas demo (desactivadas)

| Cuenta | Estado |
|--------|--------|
| `admin@colegio.demo` | Clave **rotada** a una aleatoria fuerte. Queda activa solo como admin de arranque. |
| `profesor@colegio.demo` | Clave rotada + **baneada** en Supabase Auth (no puede entrar). |
| `alumno@colegio.demo` | Clave rotada + **baneada** en Supabase Auth (no puede entrar). |

- `demo1234` ya **no funciona** en ninguna cuenta.
- La pantalla de login ya no muestra cuentas demo ni pistas.
- Las claves nuevas están solo en el archivo local **`.pilot-credentials.local`**
  (raíz del repo, gitignored, permisos 600). No se suben a Git.
- Para volver a rotar/banear: `node scripts/rotate-demo-accounts.cjs --ban=profesor,alumno`
  (o `--ban-all` cuando ya exista un admin real).

## 2. Cómo entra el colegio

1. Entrar con el admin de arranque (clave en `.pilot-credentials.local`).
2. **Admin → Usuarios → Crear usuario**: crear primero un **administrador real** del colegio
   (correo institucional). Dejar la contraseña vacía para que el sistema **genere una temporal fuerte**,
   o escribir una propia (mín. 10 caracteres con mayúsculas, minúsculas y números; se rechazan claves comunes).
3. Entregar la contraseña temporal por un canal seguro (en persona / mensaje directo), nunca en grupos.
4. Con el admin real funcionando, banear también el admin demo:
   `node scripts/rotate-demo-accounts.cjs --ban-all`.
5. Crear profesores y alumnos, luego **Asignaciones** (profesor→asignatura/grupo, alumno→grupo).
6. Si alguien olvida su clave: Usuarios → icono de llave → "Generar contraseña temporal".

## 3. Login, sesión y fuerza bruta

- Login vía `POST /api/auth/login` (servidor). Mensaje de error **genérico** ("Correo o contraseña incorrectos"),
  no revela si el correo existe o está desactivado.
- **Rate limit**: máx. **5 intentos fallidos por IP+correo** y **20 por IP** en una ventana de **15 minutos**
  → HTTP 429 "Demasiados intentos". Un login correcto limpia el contador.
  - Es en memoria por instancia de Vercel (best effort). Supabase Auth aplica además su propio límite por IP.
  - Para límite global: Upstash Redis (pendiente, opcional).
- **Logout**: `POST /api/auth/logout` revoca el refresh token en Supabase y borra las cookies `sb-*`;
  luego el cliente limpia la sesión local y redirige a `/login`.
- Duración de sesión: la de Supabase (access token 1 h, refresh token rotativo).

## 4. Autorización y datos (RLS)

**Cómo accede la app a la DB:** todas las APIs usan **Prisma con el rol `postgres`** (ignora RLS).
El navegador solo usa Supabase para Auth y para **subir** archivos. Por eso:

1. **Autorización en cada API** (`src/lib/security/authz.ts`): usuario + rol + colegio + propiedad.
   - Alumno: solo sus intentos/notas, exámenes publicados de su grupo (sin respuestas correctas),
     recursos de su grupo y **solo sus propias entregas**. No puede listar usuarios ni asignaciones.
   - Profesor: solo sus exámenes y asignaturas/grupos asignados; no puede autoasignarse.
   - Admin: todo dentro de **su** colegio.
   - Recursos de otro alumno → 404/403.
2. **RLS en Postgres** (`prisma/sql/001_pilot_rls_hardening.sql`, ya aplicado):
   RLS activado en **todas** las tablas de `public` sin políticas permisivas (deny-all) y
   `REVOKE` de todos los privilegios a `anon`/`authenticated` (también para tablas futuras).
   Antes de esto la API REST de Supabase permitía leer y modificar todas las tablas con la anon key pública.
3. **Storage**: bucket `materiales` ahora **privado**. Las descargas pasan por
   `/api/archivos/material/:id` y `/api/archivos/anuncio/:id`, que verifican permisos y redirigen a una
   URL firmada de corta duración. Subidas solo dentro de la carpeta del colegio del usuario
   (anuncios solo admin); borrado directo solo del propio archivo.
4. La `SUPABASE_SERVICE_ROLE_KEY` solo se usa en servidor (`src/lib/security/supabase-admin.ts`);
   nunca va con prefijo `NEXT_PUBLIC_`.

Reaplicar el SQL (idempotente): `node scripts/apply-sql.cjs prisma/sql/001_pilot_rls_hardening.sql`.
**Importante:** tras cada `prisma db push` que cree tablas nuevas, reaplicar el script.

## 5. Configuración Supabase / Vercel (revisar en el dashboard)

- **Authentication → URL Configuration**: *Site URL* = `https://lms-ap.vercel.app`;
  *Redirect URLs* = `https://lms-ap.vercel.app/**` (y `http://localhost:3000/**` solo si se desarrolla local).
- **Authentication → Providers → Email**: **desactivar "Allow new users to sign up"** (hoy está activado).
  Aunque un registro externo no obtiene acceso al LMS (no tiene perfil ni permisos), conviene cerrarlo.
- **Authentication → Rate limits**: revisar límites de sign-in por IP.
- Vercel: variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler 6543). Nunca exponer la service role.
- No ejecutar `npm run db:seed` contra la DB del piloto (borra datos; ahora está bloqueado salvo `SEED_ALLOW_REMOTE=1`).

## 6. Checklist antes de dar acceso al colegio

- [ ] Admin real creado y probado; admin demo baneado (`--ban-all`).
- [ ] Registro público (sign up) desactivado en Supabase.
- [ ] Site URL / Redirect URLs correctos.
- [ ] Profesores y alumnos creados con contraseñas temporales; entregadas por canal seguro.
- [ ] Asignaciones profesor→asignatura/grupo y alumno→grupo revisadas.
- [ ] Probar con un alumno: solo ve sus notas/entregas; con un profesor: solo sus grupos.
- [ ] Probar logout y que tras 5 fallos aparece el bloqueo temporal.
- [ ] Acordar con el colegio política de datos (menores de edad), respaldo y contacto de soporte.
- [ ] Rotar la service role key y la clave de DB si alguna vez se compartieron fuera del equipo.
