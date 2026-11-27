do $$
begin
  if exists (select 1 from cron.job where jobname = 'budo-push-live') then
    perform cron.unschedule('budo-push-live');
  end if;
end;
$$;
