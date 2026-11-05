-- Convidats de cada cita, per dirigir-ne els avisos.
alter table family.agenda_events
  add column attendee_emails text[] not null default '{}';
