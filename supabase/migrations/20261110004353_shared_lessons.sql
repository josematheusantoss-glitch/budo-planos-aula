create table public.instructors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key,
  plan jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index lessons_updated_at_idx on public.lessons (updated_at desc);

alter table public.instructors enable row level security;
alter table public.lessons enable row level security;

grant select on public.instructors to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;

create policy instructors_read_self on public.instructors for select to authenticated
  using (user_id = (select auth.uid()));

create policy lessons_read on public.lessons for select to authenticated
  using (exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy lessons_insert on public.lessons for insert to authenticated
  with check (exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy lessons_update on public.lessons for update to authenticated
  using (exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active))
  with check (exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy lessons_delete on public.lessons for delete to authenticated
  using (exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));

insert into storage.buckets (id, name, public) values ('lesson-videos', 'lesson-videos', false);
create policy lesson_videos_read on storage.objects for select to authenticated
  using (bucket_id = 'lesson-videos' and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy lesson_videos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-videos' and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy lesson_videos_update on storage.objects for update to authenticated
  using (bucket_id = 'lesson-videos' and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active))
  with check (bucket_id = 'lesson-videos' and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
create policy lesson_videos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-videos' and exists (select 1 from public.instructors i where i.user_id = (select auth.uid()) and i.active));
