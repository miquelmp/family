-- Configuració privada de la família, per exemple l'enllaç del grup de WhatsApp.
-- Només es modifica per SQL.
create table family.settings (
  key text primary key,
  value text not null
);

alter table family.settings enable row level security;

grant select on family.settings to authenticated;
grant all on family.settings to service_role;

create policy family_settings_read on family.settings
  for select to authenticated using (family.is_member());
