-- Общий доступ к разделам и подразделам (раньше — только к листам)
-- и разрешение «добавить к себе» для любой ссылки.

-- Ссылка на раздел или на несколько его подразделов.
-- topic_ids = null — все подразделы раздела, в том числе будущие.
create table if not exists public.library_share_bundle (
	token text primary key default replace(gen_random_uuid()::text, '-', ''),
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	kind text not null check (kind in ('section', 'topics')),
	section_id uuid not null references public.library_section (id) on delete cascade,
	topic_ids uuid[],
	allow_copy boolean not null default false,
	created_at timestamptz not null default now(),
	unique (section_id, kind)
);

create index if not exists library_share_bundle_user_idx
	on public.library_share_bundle (user_id);

alter table public.library_share_bundle enable row level security;

drop policy if exists "Own share bundles" on public.library_share_bundle;
-- Поделиться можно только своим разделом; чужие подразделы в выдачу не попадут,
-- потому что функции ниже берут подразделы только из этого раздела
create policy "Own share bundles" on public.library_share_bundle
	for all to authenticated
	using ((select auth.uid()) = user_id)
	with check (
		(select auth.uid()) = user_id
		and exists (
			select 1 from public.library_section s
			where s.id = section_id and s.user_id = (select auth.uid())
		)
	);

-- Что внутри ссылки: подразделы и названия листов, без текста (текст — отдельным запросом)
create or replace function public.get_shared_bundle(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'kind', b.kind,
		'allow_copy', b.allow_copy,
		'section_title', s.title,
		'topics', coalesce((
			select jsonb_agg(
				jsonb_build_object(
					'id', t.id,
					'title', t.title,
					'pages', coalesce((
						select jsonb_agg(
							jsonb_build_object('id', p.id, 'title', p.title, 'updated_at', p.updated_at)
							order by p.is_pinned desc, p."order", p.created_at
						)
						from public.library_page p
						where p.topic_id = t.id
					), '[]'::jsonb)
				)
				order by t.is_pinned desc, t."order", t.created_at
			)
			from public.library_topic t
			where t.section_id = b.section_id
				and (b.topic_ids is null or t.id = any (b.topic_ids))
		), '[]'::jsonb)
	)
	from public.library_share_bundle b
	join public.library_section s on s.id = b.section_id
	where b.token = p_token;
$$;

-- Тексты листов этой ссылки: только тех, что в неё входят
create or replace function public.get_shared_bundle_pages(p_token text, p_page_ids uuid[])
returns table (id uuid, title text, content text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
	select p.id, p.title, p.content, p.updated_at
	from public.library_share_bundle b
	join public.library_topic t
		on t.section_id = b.section_id
		and (b.topic_ids is null or t.id = any (b.topic_ids))
	join public.library_page p on p.topic_id = t.id
	where b.token = p_token and p.id = any (p_page_ids);
$$;

-- Разрешение «добавить к себе» у ссылок на отдельный лист
alter table public.library_share
	add column if not exists allow_copy boolean not null default false;

create or replace function public.get_shared_page_allow_copy(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(
		(select s.allow_copy from public.library_share s where s.token = p_token),
		false
	);
$$;

create or replace function public.get_page_share_allow_copy(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce((
		select s.allow_copy
		from public.library_share s
		join public.library_page p on p.id = s.page_id
		where s.page_id = p_page_id and p.user_id = (select auth.uid())
	), false);
$$;

create or replace function public.set_page_share_allow_copy(p_page_id uuid, p_allow boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not exists (
		select 1 from public.library_page p
		where p.id = p_page_id and p.user_id = (select auth.uid())
	) then
		raise exception 'not allowed';
	end if;
	update public.library_share set allow_copy = p_allow where page_id = p_page_id;
end;
$$;

revoke all on function public.get_shared_bundle(text) from public;
revoke all on function public.get_shared_bundle_pages(text, uuid[]) from public;
revoke all on function public.get_shared_page_allow_copy(text) from public;
revoke all on function public.get_page_share_allow_copy(uuid) from public;
revoke all on function public.set_page_share_allow_copy(uuid, boolean) from public;

grant execute on function public.get_shared_bundle(text) to anon, authenticated;
grant execute on function public.get_shared_bundle_pages(text, uuid[]) to anon, authenticated;
grant execute on function public.get_shared_page_allow_copy(text) to anon, authenticated;
grant execute on function public.get_page_share_allow_copy(uuid) to authenticated;
grant execute on function public.set_page_share_allow_copy(uuid, boolean) to authenticated;

-- Настройки своей ссылки — только после входа
revoke execute on function public.get_page_share_allow_copy(uuid) from anon;
revoke execute on function public.set_page_share_allow_copy(uuid, boolean) from anon;
