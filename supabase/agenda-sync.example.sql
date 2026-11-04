-- Tasca programada que copia el calendari cada 15 minuts.
-- Executa-la a l'editor SQL de Supabase, substituint SECRET_CRON pel valor del secret
-- FAMILY_CRON_SECRET. No desis mai la còpia amb el secret en aquest repositori.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'family-agenda-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://lsiggkxtgrjeilfhyewe.supabase.co/functions/v1/family-agenda-sync',
    headers := jsonb_build_object('x-family-cron', 'SECRET_CRON'),
    timeout_milliseconds := 20000
  );
  $$
);
