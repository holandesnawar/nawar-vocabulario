-- =============================================================
-- Fase 1 (corregida): Tabla de alumnos con email como identificador
-- Ejecutar en Supabase → SQL Editor → pegar todo y Run
-- =============================================================

-- 1) Tabla alumnos: lista blanca de personas autorizadas a usar la app
create table if not exists public.alumnos (
  id           uuid primary key default gen_random_uuid(),
  email        text unique not null,
  nombre       text,
  nivel        text default 'principiante',
  activo       boolean not null default true,
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Índice para búsquedas rápidas por email en el login
create index if not exists alumnos_email_idx
  on public.alumnos (lower(email));

-- 2) RLS: activado, políticas mínimas y seguras
alter table public.alumnos enable row level security;

-- Un alumno autenticado solo puede leer su propia fila
drop policy if exists "alumnos_select_own" on public.alumnos;
create policy "alumnos_select_own"
  on public.alumnos
  for select
  using (lower(auth.jwt() ->> 'email') = lower(email));

-- Nadie puede insertar/actualizar/borrar desde el cliente.
-- Tú gestionas las altas desde el panel de Supabase o con el admin client.

-- 3) Trigger para mantener updated_at
create or replace function public.tg_alumnos_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists alumnos_set_updated_at on public.alumnos;
create trigger alumnos_set_updated_at
  before update on public.alumnos
  for each row execute function public.tg_alumnos_set_updated_at();

-- 4) Vista de conveniencia: alumnos activos (la usará el backend)
create or replace view public.alumnos_activos as
  select id, email, nombre, nivel
  from public.alumnos
  where activo = true;

-- 5) (Opcional) Alumno de prueba para que puedas iniciar sesión tú mismo.
--    Cámbialo por tu email real antes de ejecutar o borra esta línea.
insert into public.alumnos (email, nombre, nivel, activo)
values ('holandesnawar@gmail.com', 'Rida (admin)', 'avanzado', true)
on conflict (email) do nothing;
