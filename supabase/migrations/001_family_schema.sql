-- Esquema family: dades del dashboard familiar.
-- Tot queda dins d'aquest esquema per poder-lo traslladar sencer a un altre projecte.
-- No afegeixis cap taula a public.

create schema if not exists family;

revoke all on schema family from public;
grant usage on schema family to authenticated, service_role;

-- Membres. Es gestionen per SQL, mai des de l'app.
create table family.members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  display_name text not null,
  short_label text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order smallint not null default 0
);

-- Setmana tipus. Cada canvi crea una fila nova amb valid_from,
-- de manera que els dies anteriors no canvien.
create table family.weekly_lunches (
  member_id uuid not null references family.members (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- 1 dilluns, 7 diumenge
  valid_from date not null,
  at_home boolean not null,
  primary key (member_id, weekday, valid_from)
);

-- Canvis puntuals per data. Tenen prioritat sobre la setmana tipus.
create table family.lunch_overrides (
  member_id uuid not null references family.members (id) on delete cascade,
  lunch_date date not null,
  at_home boolean not null,
  primary key (member_id, lunch_date)
);

create table family.menus (
  lunch_date date primary key,
  dish text not null check (length(trim(dish)) > 0)
);

create table family.shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text,
  is_usual boolean not null default false,
  on_list boolean not null default true,
  updated_at timestamptz not null default now()
);
create unique index shopping_items_name_key on family.shopping_items (lower(name));

create table family.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  assignee_id uuid references family.members (id) on delete set null,
  due_date date,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- Còpia de Google Calendar. Només hi escriu la tasca programada.
create table family.agenda_events (
  uid text primary key,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Tenir sessió no n'hi ha prou: el compte ha de ser un dels membres.
create function family.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from family.members m
    where m.email = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function family.is_member() from public;
grant execute on function family.is_member() to authenticated, service_role;

alter table family.members enable row level security;
alter table family.weekly_lunches enable row level security;
alter table family.lunch_overrides enable row level security;
alter table family.menus enable row level security;
alter table family.shopping_items enable row level security;
alter table family.tasks enable row level security;
alter table family.agenda_events enable row level security;

-- Només lectura des de l'app.
grant select on family.members, family.agenda_events to authenticated;

create policy family_members_read on family.members
  for select to authenticated using (family.is_member());
create policy family_agenda_read on family.agenda_events
  for select to authenticated using (family.is_member());

-- Lectura i escriptura per als membres.
grant select, insert, update, delete
  on family.weekly_lunches, family.lunch_overrides, family.menus,
     family.shopping_items, family.tasks
  to authenticated;

create policy family_weekly_all on family.weekly_lunches
  for all to authenticated using (family.is_member()) with check (family.is_member());
create policy family_overrides_all on family.lunch_overrides
  for all to authenticated using (family.is_member()) with check (family.is_member());
create policy family_menus_all on family.menus
  for all to authenticated using (family.is_member()) with check (family.is_member());
create policy family_shopping_all on family.shopping_items
  for all to authenticated using (family.is_member()) with check (family.is_member());
create policy family_tasks_all on family.tasks
  for all to authenticated using (family.is_member()) with check (family.is_member());

grant all on all tables in schema family to service_role;

-- Canvis al moment. La publicació només existeix a Supabase.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      family.weekly_lunches, family.lunch_overrides, family.menus,
      family.shopping_items, family.tasks, family.agenda_events;
  end if;
end;
$$;
