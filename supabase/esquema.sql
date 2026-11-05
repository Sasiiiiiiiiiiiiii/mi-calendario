-- =====================================================
-- Mi Calendario: base de datos en Supabase
-- Se pega entero en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================

-- Una fila por persona con todos sus datos (los mismos que guarda el navegador)
create table if not exists public.calendarios (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  datos jsonb not null,
  -- Lo pone la base de datos (no el navegador), así los relojes de cada aparato no importan
  actualizado timestamptz not null default now()
);

-- Cada vez que se guarda, la hora la decide el servidor
create or replace function public.poner_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

drop trigger if exists poner_actualizado on public.calendarios;
create trigger poner_actualizado
  before insert or update on public.calendarios
  for each row execute function public.poner_actualizado();

-- Seguridad: cada persona solo ve y cambia su propia fila
alter table public.calendarios enable row level security;

drop policy if exists "ver lo mío" on public.calendarios;
create policy "ver lo mío" on public.calendarios
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "crear lo mío" on public.calendarios;
create policy "crear lo mío" on public.calendarios
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "cambiar lo mío" on public.calendarios;
create policy "cambiar lo mío" on public.calendarios
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sin sesión no se puede hacer nada con la tabla
revoke all on public.calendarios from anon;
grant select, insert, update on public.calendarios to authenticated;

-- =====================================================
-- Amigos: cada persona tiene un nombre y un código para invitar
-- =====================================================
-- Estas tablas no guardan el email ni los datos del calendario. Nadie las lee
-- directamente: todo pasa por las funciones de abajo, que solo dan a cada persona
-- lo suyo y el nombre de sus amigos.

create table if not exists public.perfiles (
  user_id uuid primary key references auth.users on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 20),
  codigo text not null unique
);

-- Una fila por pareja, con el id menor primero para que no pueda salir repetida
create table if not exists public.amistades (
  usuario_a uuid not null references public.perfiles on delete cascade,
  usuario_b uuid not null references public.perfiles on delete cascade,
  creada timestamptz not null default now(),
  primary key (usuario_a, usuario_b),
  check (usuario_a < usuario_b)
);
create index if not exists amistades_usuario_b on public.amistades (usuario_b);

alter table public.perfiles enable row level security;
alter table public.amistades enable row level security;
revoke all on public.perfiles, public.amistades from anon, authenticated;

-- 8 letras y números sin los que se confunden (0/O, 1/I). Los 8 bytes usados
-- son los que en un uuid v4 son aleatorios del todo.
create or replace function public.nuevo_codigo()
returns text
language sql
volatile
set search_path = ''
as $$
  with b as (select decode(replace(gen_random_uuid()::text, '-', ''), 'hex') as bytes)
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(b.bytes, i) % 32 + 1, 1), ''
  )
  from b, unnest(array[0, 1, 2, 3, 4, 5, 10, 11]) as i;
$$;

-- Devuelve mi nombre y mi código (ninguna fila si aún no he puesto nombre)
create or replace function public.mi_perfil()
returns table (nombre text, codigo text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nombre, p.codigo from public.perfiles p where p.user_id = auth.uid();
$$;

-- Pone o cambia mi nombre; la primera vez crea también mi código
create or replace function public.guardar_nombre(nuevo text)
returns table (nombre text, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    insert into public.perfiles as p (user_id, nombre, codigo)
    values (auth.uid(), btrim(nuevo), public.nuevo_codigo())
    on conflict (user_id) do update set nombre = excluded.nombre
    returning p.nombre, p.codigo;
end;
$$;

-- Me hago amigo de quien tiene ese código (vale para los dos). Devuelve su nombre.
create or replace function public.agregar_amigo(codigo_amigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  amigo public.perfiles;
begin
  if not exists (select 1 from public.perfiles p where p.user_id = yo) then
    raise exception 'sin_nombre';
  end if;
  select * into amigo from public.perfiles p where p.codigo = upper(btrim(codigo_amigo));
  if not found then
    raise exception 'codigo_no_valido';
  end if;
  if amigo.user_id = yo then
    raise exception 'codigo_propio';
  end if;
  insert into public.amistades (usuario_a, usuario_b)
  values (least(yo, amigo.user_id), greatest(yo, amigo.user_id))
  on conflict do nothing;
  return amigo.nombre;
end;
$$;

create or replace function public.mis_amigos()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.nombre
  from public.amistades a
  join public.perfiles p
    on p.user_id = case when a.usuario_a = auth.uid() then a.usuario_b else a.usuario_a end
  where auth.uid() in (a.usuario_a, a.usuario_b)
  order by p.nombre;
$$;

create or replace function public.quitar_amigo(amigo uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.amistades
  where usuario_a = least(auth.uid(), amigo) and usuario_b = greatest(auth.uid(), amigo);
$$;

-- Solo la gente con sesión puede llamarlas, y nuevo_codigo solo se usa por dentro
revoke all on function public.nuevo_codigo() from public, anon, authenticated;
revoke all on function public.mi_perfil() from public, anon;
revoke all on function public.guardar_nombre(text) from public, anon;
revoke all on function public.agregar_amigo(text) from public, anon;
revoke all on function public.mis_amigos() from public, anon;
revoke all on function public.quitar_amigo(uuid) from public, anon;
grant execute on function public.mi_perfil() to authenticated;
grant execute on function public.guardar_nombre(text) to authenticated;
grant execute on function public.agregar_amigo(text) to authenticated;
grant execute on function public.mis_amigos() to authenticated;
grant execute on function public.quitar_amigo(uuid) to authenticated;
