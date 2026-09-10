-- ============================================================================
-- Lo mínimo de Supabase para poder probar las migraciones en un Postgres común.
-- No va nunca a la base de verdad: Supabase ya trae todo esto.
-- ============================================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- En Supabase auth.uid() sale del JWT. Acá, de una variable de sesión.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- Ayudantes de prueba
-- ---------------------------------------------------------------------------
create schema if not exists pruebas;

/** Actuar como este usuario de acá en adelante. */
create or replace function pruebas.como(p_id uuid) returns void
language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), false);
  select null::void;
$$;

create or replace function pruebas.debe_fallar(p_nombre text, p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'FALLA · ' || p_nombre || '  (no dio error y tenía que darlo)';
exception when others then
  return 'ok    · ' || p_nombre;
end $$;

create or replace function pruebas.debe_andar(p_nombre text, p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok    · ' || p_nombre;
exception when others then
  return 'FALLA · ' || p_nombre || '  [' || left(sqlerrm, 90) || ']';
end $$;

create or replace function pruebas.igual(p_nombre text, p_sql text, p_esperado text) returns text
language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  if v is not distinct from p_esperado then
    return 'ok    · ' || p_nombre;
  end if;
  return 'FALLA · ' || p_nombre || '  (esperaba ' || coalesce(p_esperado,'null')
         || ', dio ' || coalesce(v,'null') || ')';
exception when others then
  return 'FALLA · ' || p_nombre || '  [' || left(sqlerrm, 90) || ']';
end $$;

grant usage on schema pruebas to authenticated, anon, public;
grant execute on all functions in schema pruebas to authenticated, anon, public;
