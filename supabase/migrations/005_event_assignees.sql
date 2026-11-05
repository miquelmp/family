-- Membres a qui va dirigida cada cita.
-- No té clau forana cap a agenda_events perquè aquesta taula es refà amb cada còpia.
create table family.event_assignees (
  event_uid text not null,
  member_id uuid not null references family.members (id) on delete cascade,
  primary key (event_uid, member_id)
);

alter table family.event_assignees enable row level security;

grant select, insert, update, delete on family.event_assignees to authenticated;
grant all on family.event_assignees to service_role;

create policy family_event_assignees_all on family.event_assignees
  for all to authenticated using (family.is_member()) with check (family.is_member());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table family.event_assignees;
  end if;
end;
$$;
