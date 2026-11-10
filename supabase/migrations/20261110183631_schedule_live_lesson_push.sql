create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule(
  'budo-push-live',
  '30 seconds',
  $job$
    select net.http_post(
      url := 'https://jzqoyddbebrydckzvjuu.supabase.co/functions/v1/budo-push',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-budo-cron',(select decrypted_secret from vault.decrypted_secrets where name='budo_push_cron_token' limit 1)
      ),
      timeout_milliseconds := 15000
    );
  $job$
);
