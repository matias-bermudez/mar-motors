-- Mar Motors — base de datos.
-- Pegar entero en Supabase → SQL Editor → Run. Se puede correr más de una vez.

-- ── Autos ─────────────────────────────────────────────────────────
create table if not exists public.autos (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  marca       text not null,
  modelo      text not null,                       -- modelo y versión: "Onix LT 1.4"
  anio        int  not null check (anio between 1900 and 2100),
  km          int  not null default 0 check (km >= 0),
  precio      int  check (precio >= 0),            -- vacío = "Consultar"
  moneda      text not null default 'USD' check (moneda in ('USD', 'UYU')),
  carroceria  text not null default 'hatch' check (carroceria in ('sedan', 'hatch', 'suv', 'pickup', 'utilitario')),
  combustible text not null default 'Nafta',       -- Nafta, Diésel, Híbrido, Eléctrico, GNC
  caja        text not null default 'Manual',      -- Manual, Automática
  motor       text,                                -- "1.6"
  color       text,
  puertas     int,
  descripcion text,
  fotos       text[] not null default '{}',        -- URLs públicas, la primera es la portada
  estado      text not null default 'disponible' check (estado in ('disponible', 'reservado', 'vendido')),
  publicado   boolean not null default true
);

create or replace function public.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists autos_updated_at on public.autos;
create trigger autos_updated_at before update on public.autos
  for each row execute function public.tocar_updated_at();

-- ── Admins ────────────────────────────────────────────────────────
-- Solo los emails de esta lista pueden cargar, editar o borrar autos y fotos.
-- El usuario se crea aparte en Authentication → Users (ver README).
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;  -- sin políticas: nadie la lee desde la web

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ── Permisos de autos ─────────────────────────────────────────────
alter table public.autos enable row level security;

drop policy if exists "autos publicados visibles" on public.autos;
create policy "autos publicados visibles" on public.autos
  for select using (publicado or public.es_admin());

drop policy if exists "admin carga autos" on public.autos;
create policy "admin carga autos" on public.autos
  for insert to authenticated with check (public.es_admin());

drop policy if exists "admin edita autos" on public.autos;
create policy "admin edita autos" on public.autos
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin borra autos" on public.autos;
create policy "admin borra autos" on public.autos
  for delete to authenticated using (public.es_admin());

-- ── Fotos ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin sube fotos" on storage.objects;
create policy "admin sube fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos' and public.es_admin());

drop policy if exists "admin lista fotos" on storage.objects;
create policy "admin lista fotos" on storage.objects
  for select to authenticated using (bucket_id = 'fotos' and public.es_admin());

drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin borra fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos' and public.es_admin());

-- ── Tu email de admin ─────────────────────────────────────────────
-- Cambiá el email y corré esta línea (podés agregar más de uno).
-- insert into public.admins (email) values ('dueno@marmotors.com.uy') on conflict do nothing;
