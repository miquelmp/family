-- Hora del dinar de cada membre. Buida vol dir l'hora habitual de la família.
alter table family.weekly_lunches add column lunch_time time;
alter table family.lunch_overrides add column lunch_time time;

-- Hora habitual de la família.
insert into family.settings (key, value) values ('lunch_time', '14:30')
on conflict (key) do nothing;
