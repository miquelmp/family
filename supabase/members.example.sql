-- Plantilla per afegir els 4 membres.
-- Executa-la a l'editor SQL de Supabase amb les dades reals.
-- No desis mai aquestes dades al repositori: és públic.

insert into family.members (email, display_name, short_label, color, sort_order) values
  ('correu1@example.com', 'NOM 1', 'N1', '#1D4ED8', 1), -- blau
  ('correu2@example.com', 'NOM 2', 'N2', '#C2410C', 2), -- taronja
  ('correu3@example.com', 'NOM 3', 'N3', '#0F766E', 3), -- verd blavós
  ('correu4@example.com', 'NOM 4', 'N4', '#6D28D9', 4); -- lila
