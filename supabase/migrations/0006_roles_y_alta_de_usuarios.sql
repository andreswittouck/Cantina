-- ============================================================================
-- Migración 0006 · Rol ADMIN y alta de usuarios controlada
-- ----------------------------------------------------------------------------
-- Cómo se corre: Supabase → tu proyecto → SQL Editor → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Qué cambia:
--   1. Aparece el rol ADMIN, arriba de DUENO. Un admin puede todo lo que puede
--      el dueño, y además puede crear otros admins.
--   2. Nadie se registra solo. Las altas las hace un dueño o un admin desde el
--      sistema, eligiendo el rol. La única excepción es el PRIMER usuario:
--      cuando la base está vacía, el que se registra queda ADMIN.
--   3. Nadie se puede cambiar el rol a sí mismo. Antes sí se podía: la política
--      "usuarios_update_propio" dejaba que un cajero se pusiera DUENO llamando
--      a la API con la clave pública. Eso se cierra acá.
--
-- OJO con el enum: Postgres no deja USAR un valor nuevo de un enum en la misma
-- transacción en que se agrega. Por eso en todo este archivo las comparaciones
-- son contra texto (rol::text = 'ADMIN') y nunca contra el literal del enum.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. El rol nuevo
-- ---------------------------------------------------------------------------
alter type public.rol_usuario add value if not exists 'ADMIN';

-- ---------------------------------------------------------------------------
-- 2. Jerarquía
--    Un solo lugar donde está escrito quién manda más. Todo lo demás pregunta
--    acá, así no hay dos reglas distintas dando vueltas.
-- ---------------------------------------------------------------------------
create or replace function public.rango_rol(p_rol text)
returns int
language sql
immutable
as $$
  select case upper(coalesce(p_rol, ''))
    when 'ADMIN'  then 3
    when 'DUENO'  then 2
    when 'CAJERO' then 1
    else 0
  end;
$$;

comment on function public.rango_rol(text) is
  'ADMIN 3 > DUENO 2 > CAJERO 1. Cualquier otra cosa, 0 (o sea: nada).';

/** Rol del que está logueado, o null si no hay sesión o está desactivado. */
create or replace function public.rol_actual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol::text from public.usuarios where id = auth.uid() and activo;
$$;

create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.rango_rol(public.rol_actual()) >= 3;
$$;

-- es_dueno() ahora quiere decir "manda acá": DUENO **o** ADMIN.
-- Se redefine a propósito, para que todas las políticas que ya existen
-- (productos, ajustes de saldo, reabrir caja, auditoría) valgan también para
-- el admin sin tener que tocar las migraciones anteriores.
create or replace function public.es_dueno()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.rango_rol(public.rol_actual()) >= 2;
$$;

comment on function public.es_dueno() is
  'Verdadero para DUENO y para ADMIN. Es el permiso de "esto lo decide el que manda".';

/**
 * ¿El usuario actual puede dar este rol?
 * Regla: tenés que ser dueño o admin, y solo podés dar roles de rango menor o
 * igual al tuyo.
 *   ADMIN  → admin, dueño y cajero
 *   DUENO  → dueño y cajero (nunca admin)
 *   CAJERO → nada, ni siquiera otro cajero
 */
create or replace function public.puede_otorgar_rol(p_rol text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.es_dueno()
     and public.rango_rol(p_rol) between 1 and public.rango_rol(public.rol_actual());
$$;

/**
 * ¿Ya hay alguien cargado? La usa la pantalla de registro para saber si todavía
 * está abierta. Es SECURITY DEFINER porque tiene que poder contestarle a alguien
 * sin sesión, sin dejarle ver ni un dato de nadie.
 */
create or replace function public.hay_usuarios()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.usuarios);
$$;

grant execute on function public.rango_rol(text)        to anon, authenticated;
grant execute on function public.rol_actual()           to authenticated;
grant execute on function public.es_admin()             to authenticated;
grant execute on function public.puede_otorgar_rol(text) to authenticated;
grant execute on function public.hay_usuarios()         to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Altas pendientes
--    El puente entre "el admin apretó Crear" y "Supabase creó el login".
--
--    Por qué existe: el rol NO puede venir en los metadatos del signup, porque
--    cualquiera con la clave pública puede mandar los metadatos que quiera y
--    se haría admin solo. Entonces el rol se guarda ANTES, en esta tabla, con
--    la sesión del que lo está creando: ahí RLS revisa de verdad si puede dar
--    ese rol. Cuando Supabase crea el login, el trigger lee de acá.
-- ---------------------------------------------------------------------------
create table if not exists public.altas_pendientes (
  email      text primary key,
  nombre     text not null,
  rol        public.rol_usuario not null,
  creado_por uuid not null references public.usuarios (id) on delete cascade,
  creado_en  timestamptz not null default now()
);

comment on table public.altas_pendientes is
  'Rol reservado para un email que todavía no terminó de crearse. El trigger de alta lo consume y borra la fila.';

-- El email siempre en minúsculas y sin espacios, para que el trigger lo encuentre.
create or replace function public.normalizar_email_alta()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists altas_pendientes_normalizar on public.altas_pendientes;
create trigger altas_pendientes_normalizar
  before insert or update on public.altas_pendientes
  for each row execute function public.normalizar_email_alta();

alter table public.altas_pendientes enable row level security;

drop policy if exists altas_select on public.altas_pendientes;
create policy altas_select on public.altas_pendientes
  for select to authenticated
  using (public.es_dueno());

-- Acá está la barrera de verdad: no alcanza con ser dueño, además el rol que
-- estás reservando tiene que ser uno que puedas dar.
drop policy if exists altas_insert on public.altas_pendientes;
create policy altas_insert on public.altas_pendientes
  for insert to authenticated
  with check (
    public.es_dueno()
    and creado_por = auth.uid()
    and public.puede_otorgar_rol(rol::text)
  );

drop policy if exists altas_delete on public.altas_pendientes;
create policy altas_delete on public.altas_pendientes
  for delete to authenticated
  using (public.es_dueno());

grant select, insert, delete on public.altas_pendientes to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Alta del perfil
--    Reemplaza a la de la 0001. Antes: el primero DUENO, el resto CAJERO, y
--    cualquiera se podía registrar. Ahora nadie entra si no lo invitaron.
-- ---------------------------------------------------------------------------
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alta   public.altas_pendientes%rowtype;
  v_rol    public.rol_usuario;
  v_nombre text;
  v_email  text := lower(trim(new.email));
begin
  if (select count(*) from public.usuarios) = 0 then
    -- Base vacía: este es el que arranca todo, y queda ADMIN porque alguien
    -- tiene que poder crear a los demás.
    v_rol := 'ADMIN';
    v_nombre := coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      split_part(v_email, '@', 1)
    );
  else
    select * into v_alta
    from public.altas_pendientes
    where email = v_email;

    if not found then
      raise exception
        'Las altas de usuario las hace un dueño o un administrador desde el sistema.'
        using errcode = 'check_violation';
    end if;

    v_rol    := v_alta.rol;
    v_nombre := v_alta.nombre;

    delete from public.altas_pendientes where email = v_email;
  end if;

  insert into public.usuarios (id, email, nombre, rol)
  values (new.id, v_email, v_nombre, v_rol)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Qué se puede cambiar de un usuario
--    Cada uno puede editar su nombre. El rol y el activo son otra cosa.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin sesión solo se llega desde el SQL Editor o con la service_role, que ya
  -- son la llave maestra: no tiene sentido frenarlas acá.
  if auth.uid() is null then
    return new;
  end if;

  -- El id y el email no se tocan por acá: el email vive en auth.users.
  new.id    := old.id;
  new.email := old.email;

  if new.rol is distinct from old.rol then
    if old.id = auth.uid() then
      raise exception 'No podés cambiarte el rol a vos mismo.';
    end if;

    if not public.puede_otorgar_rol(new.rol::text) then
      raise exception 'No tenés permiso para dar el rol %.', new.rol;
    end if;

    if public.rango_rol(old.rol::text) > public.rango_rol(public.rol_actual()) then
      raise exception 'No podés modificar a un usuario con más permisos que vos.';
    end if;
  end if;

  if new.activo is distinct from old.activo then
    -- En los dos sentidos: nadie se saca ni se devuelve el acceso solo.
    if old.id = auth.uid() then
      raise exception 'El acceso de alguien lo cambia otra persona, no uno mismo.';
    end if;

    if not public.es_dueno() then
      raise exception 'Solo un dueño o un administrador puede activar o desactivar usuarios.';
    end if;

    if public.rango_rol(old.rol::text) > public.rango_rol(public.rol_actual()) then
      raise exception 'No podés modificar a un usuario con más permisos que vos.';
    end if;
  end if;

  -- Nunca quedarse sin nadie que pueda administrar el sistema.
  if old.activo and old.rol::text = 'ADMIN'
     and (not new.activo or new.rol::text <> 'ADMIN')
     and not exists (
       select 1 from public.usuarios
       where id <> old.id and activo and rol::text = 'ADMIN'
     )
  then
    raise exception 'Tiene que quedar al menos un administrador activo.';
  end if;

  return new;
end;
$$;

drop trigger if exists usuarios_proteger on public.usuarios;
create trigger usuarios_proteger
  before update on public.usuarios
  for each row execute function public.proteger_usuario();

-- ---------------------------------------------------------------------------
-- 6. Listo.
--    Si ya venías usando el sistema, el usuario que hoy es DUENO sigue siendo
--    DUENO. Para tener un ADMIN, corré esto UNA vez con tu email (en una
--    consulta aparte, después de esta migración: el enum recién existe cuando
--    esta terminó):
--
--      update public.usuarios set rol = 'ADMIN' where email = 'vos@ejemplo.com';
-- ---------------------------------------------------------------------------
