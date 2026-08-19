-- ============================================================================
-- Migración 0001 · Usuarios, roles y auditoría
-- ----------------------------------------------------------------------------
-- Cómo se corre: Supabase → tu proyecto → SQL Editor → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada (usa IF NOT EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario') then
    create type public.rol_usuario as enum ('DUENO', 'CAJERO');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Perfil de usuario
--    auth.users guarda el email y la contraseña (lo maneja Supabase).
--    public.usuarios guarda lo del negocio: nombre, rol, si está activo.
-- ---------------------------------------------------------------------------
create table if not exists public.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  nombre      text not null,
  rol         public.rol_usuario not null default 'CAJERO',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.usuarios is
  'Perfil de negocio de cada usuario. El login vive en auth.users.';

-- ---------------------------------------------------------------------------
-- 3. Auditoría: quién hizo qué y cuándo.
--    Es lo que te salva cuando alguien discute un saldo.
-- ---------------------------------------------------------------------------
create table if not exists public.auditoria (
  id           bigint generated always as identity primary key,
  usuario_id   uuid references public.usuarios (id) on delete set null,
  tabla        text not null,
  registro_id  text,
  accion       text not null,           -- 'INSERT' | 'UPDATE' | 'DELETE' | 'ANULAR' | 'LOGIN'
  datos_antes  jsonb,
  datos_despues jsonb,
  creado_en    timestamptz not null default now()
);

create index if not exists auditoria_tabla_idx
  on public.auditoria (tabla, creado_en desc);
create index if not exists auditoria_usuario_idx
  on public.auditoria (usuario_id, creado_en desc);

-- ---------------------------------------------------------------------------
-- 4. Funciones de ayuda para los permisos
--    SECURITY DEFINER para que las políticas RLS no se llamen a sí mismas.
-- ---------------------------------------------------------------------------
create or replace function public.es_dueno()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and rol = 'DUENO' and activo
  );
$$;

create or replace function public.usuario_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and activo
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Alta automática del perfil cuando se crea un usuario en Supabase Auth.
--    El PRIMER usuario del sistema queda como DUEÑO; el resto, CAJERO.
--    El rol NUNCA se toma de lo que manda el cliente: si no, cualquiera
--    podría registrarse como dueño.
-- ---------------------------------------------------------------------------
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario;
  v_nombre text;
begin
  if (select count(*) from public.usuarios) = 0 then
    v_rol := 'DUENO';
  else
    v_rol := 'CAJERO';
  end if;

  v_nombre := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.usuarios (id, email, nombre, rol)
  values (new.id, new.email, v_nombre, v_rol)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- ---------------------------------------------------------------------------
-- 6. actualizado_en automático (sirve para todas las tablas que vengan)
-- ---------------------------------------------------------------------------
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists usuarios_actualizado_en on public.usuarios;
create trigger usuarios_actualizado_en
  before update on public.usuarios
  for each row execute function public.tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
--    Por defecto NADIE ve nada. Se habilita explícitamente.
-- ---------------------------------------------------------------------------
alter table public.usuarios  enable row level security;
alter table public.auditoria enable row level security;

-- usuarios ------------------------------------------------------------------
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select to authenticated
  using (public.usuario_activo());

drop policy if exists usuarios_update_propio on public.usuarios;
create policy usuarios_update_propio on public.usuarios
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists usuarios_update_dueno on public.usuarios;
create policy usuarios_update_dueno on public.usuarios
  for update to authenticated
  using (public.es_dueno())
  with check (public.es_dueno());

-- Nadie inserta ni borra usuarios por API: el alta la hace el trigger y la
-- baja es lógica (activo = false).

-- auditoria -----------------------------------------------------------------
drop policy if exists auditoria_select_dueno on public.auditoria;
create policy auditoria_select_dueno on public.auditoria
  for select to authenticated
  using (public.es_dueno());

drop policy if exists auditoria_insert on public.auditoria;
create policy auditoria_insert on public.auditoria
  for insert to authenticated
  with check (public.usuario_activo() and usuario_id = auth.uid());

-- La auditoría no se edita ni se borra. Ese es todo el punto.

-- ---------------------------------------------------------------------------
-- 8. Permisos de tabla (GRANT)
--    RLS decide QUÉ FILAS ve cada uno, pero primero hay que tener permiso
--    sobre la tabla. Supabase suele darlos solos con default privileges; los
--    ponemos explícitos igual para que la base sea reproducible en cualquier
--    Postgres y para que quede escrito quién puede hacer qué.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, update            on public.usuarios  to authenticated;
grant select, insert            on public.auditoria to authenticated;

-- Nadie borra usuarios ni auditoría por API. La baja es lógica (activo=false).

-- ---------------------------------------------------------------------------
-- 9. Listo.
--    Siguiente paso: crear el primer usuario desde la app (/registro) o desde
--    Supabase → Authentication → Users → Add user. Ese primero queda DUEÑO.
-- ---------------------------------------------------------------------------
