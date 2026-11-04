-- Tasca programada dels avisos. S'executa cada hora; la funció decideix si toca avisar.
-- Executa-la a l'editor SQL de Supabase, substituint SECRET_CRON pel valor del secret
-- FAMILY_CRON_SECRET. No desis mai la còpia amb el secret en aquest repositori.

select cron.schedule(
  'family-reminders',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://lsiggkxtgrjeilfhyewe.supabase.co/functions/v1/family-reminders',
    headers := jsonb_build_object('x-family-cron', 'SECRET_CRON'),
    timeout_milliseconds := 20000
  );
  $$
);
