-- PROPUESTA PENDIENTE DE AUTORIZACIÓN. NO EJECUTAR. Revisar con el propietario de la base antes de cualquier uso.
-- Las tablas llevan el prefijo juego_ para no chocar con las existentes. Solo se asume auth.users (estándar de Supabase); confirmar.
create table juego_perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usuario text not null check (usuario ~ '^[A-Za-z0-9_]{3,16}$'),
  avatar jsonb not null default '{}', nivel_max int not null default 1 check (nivel_max between 1 and 999),
  creado timestamptz not null default now()
);
create unique index juego_perfiles_usuario_uq on juego_perfiles (lower(usuario));
create table juego_partidas (
  user_id uuid not null references auth.users(id) on delete cascade,
  giro text not null check (giro in ('restaurante','cafeteria')),
  version_esquema int not null default 1, version_fila bigint not null default 1,
  datos jsonb not null check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) < 20000),
  actualizado timestamptz not null default now(),
  primary key (user_id, giro)
);
create table juego_eventos (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  giro text not null, tipo text not null, monto int not null, saldo int not null check (saldo >= 0), creado timestamptz not null default now()
);
create index juego_eventos_user_idx on juego_eventos (user_id, creado desc);
alter table juego_perfiles enable row level security; alter table juego_partidas enable row level security; alter table juego_eventos enable row level security;
create policy perfiles_propios on juego_perfiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy partidas_leer on juego_partidas for select using (user_id = auth.uid());   -- escribir solo vía la función
create policy eventos_leer on juego_eventos for select using (user_id = auth.uid());
-- Escritura transaccional con control de versión (evita pisar un guardado más nuevo desde otro dispositivo).
create function juego_guardar_partida(p_giro text, p_datos jsonb, p_version_esperada bigint) returns bigint
language plpgsql security invoker as $$
declare v bigint;
begin
  insert into juego_partidas (user_id, giro, datos) values (auth.uid(), p_giro, p_datos)
  on conflict (user_id, giro) do update set datos = excluded.datos, version_fila = juego_partidas.version_fila + 1, actualizado = now()
  where juego_partidas.version_fila = p_version_esperada or p_version_esperada is null
  returning version_fila into v;
  if v is null then raise exception 'CONFLICTO_DE_VERSION'; end if;
  return v;
end $$;
-- Pendiente de revisar: la economía online compartida (salas) debe validarse en servidor, no desde el cliente.
