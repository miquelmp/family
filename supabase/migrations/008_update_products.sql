-- Actualitza els productes habituals amb botó.
delete from family.shopping_items where lower(name) = 'aigua';

update family.shopping_items
set name = 'Coca-cola'
where lower(name) = 'refrescos'
  and not exists (select 1 from family.shopping_items where lower(name) = 'coca-cola');

insert into family.shopping_items (name, category, is_usual, on_list) values
  ('Coca-cola', 'Begudes', true, false),
  ('Cervesa', 'Begudes', true, false),
  ('Clara', 'Begudes', true, false),
  ('Abrillantador', 'Neteja', true, false),
  ('Sal rentavaixelles', 'Neteja', true, false),
  ('Vinagre', 'Rebost', true, false)
on conflict ((lower(name))) do update
  set category = excluded.category, is_usual = true;
