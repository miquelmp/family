-- Ordre manual dels productes dins de cada categoria. Sense ordre, van al final per nom.
alter table family.shopping_items
  add column sort_order smallint not null default 100;

insert into family.shopping_items (name, category, is_usual, on_list) values
  ('Vi', 'Begudes', true, false)
on conflict ((lower(name))) do update
  set category = excluded.category, is_usual = true;

update family.shopping_items
set sort_order = case lower(name)
  when 'cafè' then 1
  when 'llet' then 2
  when 'vi' then 3
  when 'cervesa' then 4
  when 'clara' then 5
  when 'coca-cola' then 6
end
where lower(name) in ('cafè', 'llet', 'vi', 'cervesa', 'clara', 'coca-cola');
