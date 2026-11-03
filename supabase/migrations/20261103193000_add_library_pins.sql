alter table public.library_section
	add column if not exists is_pinned boolean not null default false;

alter table public.library_topic
	add column if not exists is_pinned boolean not null default false;

alter table public.library_page
	add column if not exists is_pinned boolean not null default false;
