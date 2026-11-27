create table public.lesson_reflections (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  worked text not null default '',
  adjust text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.lesson_reflections enable row level security;
revoke all on public.lesson_reflections from anon, authenticated;
grant select, insert, update on public.lesson_reflections to authenticated;
create policy lesson_reflections_read on public.lesson_reflections for select to authenticated using (exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy lesson_reflections_insert on public.lesson_reflections for insert to authenticated with check (exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy lesson_reflections_update on public.lesson_reflections for update to authenticated using (exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active)) with check (exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create index lesson_reflections_updated_at_idx on public.lesson_reflections(updated_at desc);
