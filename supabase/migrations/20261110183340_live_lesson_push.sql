create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy push_subscriptions_self_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()) and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy push_subscriptions_self_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy push_subscriptions_self_update on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid()) and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active)) with check (user_id = (select auth.uid()) and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy push_subscriptions_self_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()) and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create table public.push_alerts (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  stage_index integer not null,
  level integer not null check (level between 1 and 3),
  sent_at timestamptz not null default now(),
  primary key (lesson_id, stage_index)
);
alter table public.push_alerts enable row level security;
revoke all on public.push_alerts from anon, authenticated;
create function public.budo_push_config()
returns table (vapid_private text, cron_token text)
language sql security definer set search_path = ''
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'budo_vapid_private' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name = 'budo_push_cron_token' limit 1)
$$;
revoke all on function public.budo_push_config() from public, anon, authenticated;
grant execute on function public.budo_push_config() to service_role;
