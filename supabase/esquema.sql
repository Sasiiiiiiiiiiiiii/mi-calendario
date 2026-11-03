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
