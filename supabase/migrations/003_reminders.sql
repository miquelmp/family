-- Avisos: cada mòbil activat és una subscripció del seu membre.

create function family.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from family.members m
  where m.email = lower(auth.jwt() ->> 'email');
$$;

revoke all on function family.current_member_id() from public;
grant execute on function family.current_member_id() to authenticated, service_role;

create table family.push_subscriptions (
  endpoint text primary key,
  member_id uuid not null references family.members (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table family.push_subscriptions enable row level security;

-- Cada membre només gestiona les seves subscripcions.
grant select, insert, update, delete on family.push_subscriptions to authenticated;

create policy family_push_own on family.push_subscriptions
  for all to authenticated
  using (member_id = family.current_member_id())
  with check (member_id = family.current_member_id());

-- Evita enviar dues vegades el mateix aviso. Només hi accedeix la tasca programada.
create table family.sent_reminders (
  key text primary key,
  sent_at timestamptz not null default now()
);

alter table family.sent_reminders enable row level security;

grant all on family.push_subscriptions, family.sent_reminders to service_role;
