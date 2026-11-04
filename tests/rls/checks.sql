\set ON_ERROR_STOP on

insert into family.members (email, display_name, short_label, color, sort_order) values
  ('membre@example.com', 'Membre', 'Me', '#1D4ED8', 1);

create function pg_temp.expect_denied(role_name text, claims text, statement text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', claims, true);
  execute format('set local role %I', role_name);
  begin
    execute statement;
  exception when insufficient_privilege then
    reset role;
    return;
  end;
  reset role;
  raise exception 'Hauria d''estar denegat: % com a %', statement, role_name;
end;
$$;

create function pg_temp.visible_members(role_name text, claims text)
returns bigint language plpgsql as $$
declare
  total bigint;
begin
  perform set_config('request.jwt.claims', claims, true);
  execute format('set local role %I', role_name);
  execute 'select count(*) from family.members' into total;
  reset role;
  return total;
end;
$$;

begin;

do $$
begin
  -- Cap taula fora de l'esquema family.
  assert (select count(*) from pg_tables where schemaname = 'public') = 0,
    'No hi ha d''haver taules a public';

  -- Totes les taules tenen regles d'accés actives.
  assert (select count(*) from pg_tables where schemaname = 'family' and not rowsecurity) = 0,
    'Totes les taules han de tenir RLS';
end;
$$;

-- Sense sessió: cap accés.
select pg_temp.expect_denied('anon', '{}', 'select * from family.members');
select pg_temp.expect_denied('anon', '{}', 'select * from family.tasks');

-- Amb sessió però fora de la família: no veu res i no pot escriure.
do $$
begin
  assert pg_temp.visible_members(
    'authenticated', '{"email":"alie@example.com"}') = 0,
    'Un compte aliè no ha de veure membres';
end;
$$;

select pg_temp.expect_denied(
  'authenticated', '{"email":"alie@example.com"}',
  'insert into family.tasks (title) values (''intrusió'')');
select pg_temp.expect_denied(
  'authenticated', '{"email":"alie@example.com"}',
  'insert into family.shopping_items (name) values (''intrusió'')');

-- Membre: veu i escriu dades, sense distingir majúscules al correu.
do $$
begin
  assert pg_temp.visible_members(
    'authenticated', '{"email":"Membre@Example.com"}') = 1,
    'Un membre ha de veure els membres';

  perform set_config('request.jwt.claims', '{"email":"membre@example.com"}', true);
  set local role authenticated;
  insert into family.shopping_items (name, is_usual) values ('Producte de prova', true);
  insert into family.tasks (title) values ('Parar taula');
  insert into family.menus (lunch_date, dish) values ('2026-11-04', 'Crema');
  reset role;
end;
$$;

-- Ni un membre pot canviar la llista de membres ni l'agenda copiada.
select pg_temp.expect_denied(
  'authenticated', '{"email":"membre@example.com"}',
  'update family.members set display_name = ''x''');
select pg_temp.expect_denied(
  'authenticated', '{"email":"membre@example.com"}',
  'delete from family.members');
select pg_temp.expect_denied(
  'authenticated', '{"email":"membre@example.com"}',
  'insert into family.agenda_events (uid, title, starts_at) values (''x'', ''x'', now())');

-- La tasca programada sí que pot escriure a l'agenda.
do $$
begin
  set local role service_role;
  insert into family.agenda_events (uid, title, starts_at) values ('a', 'Cita', now());
  reset role;
end;
$$;

-- Cada membre només gestiona les seves subscripcions als avisos.
insert into family.members (id, email, display_name, short_label, color, sort_order) values
  ('00000000-0000-0000-0000-000000000002', 'segon@example.com', 'Segon', 'Se', '#C2410C', 2);

do $$
declare
  own uuid;
  visible bigint;
begin
  select id into own from family.members where email = 'membre@example.com';

  perform set_config('request.jwt.claims', '{"email":"membre@example.com"}', true);
  set local role authenticated;
  execute format(
    'insert into family.push_subscriptions (endpoint, member_id, p256dh, auth) values (%L, %L, %L, %L)',
    'https://push.example.com/1', own, 'clau', 'auth');
  reset role;

  perform set_config('request.jwt.claims', '{"email":"segon@example.com"}', true);
  set local role authenticated;
  select count(*) into visible from family.push_subscriptions;
  reset role;
  assert visible = 0, 'Un membre no ha de veure les subscripcions dels altres';
end;
$$;

select pg_temp.expect_denied(
  'authenticated', '{"email":"membre@example.com"}',
  $sql$insert into family.push_subscriptions (endpoint, member_id, p256dh, auth)
       values ('https://push.example.com/2', '00000000-0000-0000-0000-000000000002', 'c', 'a')$sql$);
select pg_temp.expect_denied(
  'authenticated', '{"email":"alie@example.com"}',
  $sql$insert into family.push_subscriptions (endpoint, member_id, p256dh, auth)
       values ('https://push.example.com/3', '00000000-0000-0000-0000-000000000002', 'c', 'a')$sql$);
select pg_temp.expect_denied(
  'authenticated', '{"email":"membre@example.com"}', 'select * from family.sent_reminders');

-- No es poden duplicar productes, ni canviant majúscules.
do $$
begin
  begin
    insert into family.shopping_items (name) values ('PRODUCTE DE PROVA');
    raise exception 'El producte duplicat s''hauria d''haver rebutjat';
  exception when unique_violation then
    null;
  end;
end;
$$;

rollback;

\echo 'Regles d''accés: totes les comprovacions superades'
