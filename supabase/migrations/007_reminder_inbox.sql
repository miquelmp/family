-- Avisos rebuts per cada membre, per veure'ls a l'app com a novetats.
-- Només hi escriu la tasca programada; cada membre pot marcar els seus com a llegits.
create table family.reminder_inbox (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references family.members (id) on delete cascade,
  title text not null,
  body text not null,
  target text not null check (target in ('setmana', 'casa')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index reminder_inbox_member on family.reminder_inbox (member_id, created_at desc);

alter table family.reminder_inbox enable row level security;

grant select on family.reminder_inbox to authenticated;
grant update (read_at) on family.reminder_inbox to authenticated;
grant all on family.reminder_inbox to service_role;

create policy family_inbox_read on family.reminder_inbox
  for select to authenticated using (member_id = family.current_member_id());
create policy family_inbox_mark on family.reminder_inbox
  for update to authenticated
  using (member_id = family.current_member_id())
  with check (member_id = family.current_member_id());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table family.reminder_inbox;
  end if;
end;
$$;
