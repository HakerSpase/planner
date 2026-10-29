-- Архив: разделы → темы → листы. Доступ только к своим записям (RLS),
-- браузер работает с таблицами напрямую, без серверных функций Vercel.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create table public.library_section (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	title text not null check (char_length(title) between 1 and 200),
	"order" integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.library_topic (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	section_id uuid not null references public.library_section (id) on delete cascade,
	title text not null check (char_length(title) between 1 and 200),
	"order" integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.library_page (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	topic_id uuid not null references public.library_topic (id) on delete cascade,
	title text not null default '' check (char_length(title) <= 300),
	content text not null default '' check (char_length(content) <= 500000),
	"order" integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index library_section_user_idx on public.library_section (user_id, "order");
create index library_topic_section_idx on public.library_topic (section_id, "order");
create index library_topic_user_idx on public.library_topic (user_id);
create index library_page_topic_idx on public.library_page (topic_id, "order");
create index library_page_user_idx on public.library_page (user_id);

create trigger library_section_updated before update on public.library_section
	for each row execute function public.set_updated_at();
create trigger library_topic_updated before update on public.library_topic
	for each row execute function public.set_updated_at();
create trigger library_page_updated before update on public.library_page
	for each row execute function public.set_updated_at();

alter table public.library_section enable row level security;
alter table public.library_topic enable row level security;
alter table public.library_page enable row level security;

create policy "Own sections" on public.library_section
	for all to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

-- тему можно положить только в свой раздел
create policy "Own topics" on public.library_topic
	for all to authenticated
	using ((select auth.uid()) = user_id)
	with check (
		(select auth.uid()) = user_id
		and exists (
			select 1 from public.library_section s
			where s.id = section_id and s.user_id = (select auth.uid())
		)
	);

-- лист можно положить только в свою тему
create policy "Own pages" on public.library_page
	for all to authenticated
	using ((select auth.uid()) = user_id)
	with check (
		(select auth.uid()) = user_id
		and exists (
			select 1 from public.library_topic t
			where t.id = topic_id and t.user_id = (select auth.uid())
		)
	);
