create table if not exists public.daily_thought (
	user_id uuid not null references auth.users(id) on delete cascade,
	thought_date date not null,
	content text not null default '',
	updated_at timestamptz not null default now(),
	primary key (user_id, thought_date),
	constraint daily_thought_content_length check (char_length(content) <= 20000)
);

alter table public.daily_thought enable row level security;

create policy "Users can read their own daily thoughts"
	on public.daily_thought for select to authenticated
	using ((select auth.uid()) = user_id);

create policy "Users can create their own daily thoughts"
	on public.daily_thought for insert to authenticated
	with check ((select auth.uid()) = user_id);

create policy "Users can update their own daily thoughts"
	on public.daily_thought for update to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

grant select, insert, update on public.daily_thought to authenticated;
revoke all on public.daily_thought from anon;
