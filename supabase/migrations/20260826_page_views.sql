create table if not exists public.page_views (
  day date not null,
  path text not null,
  views integer not null default 0,
  primary key (day, path)
);

alter table public.page_views enable row level security;

create or replace function public.increment_page_view(p_day date, p_path text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.page_views (day, path, views)
  values (p_day, p_path, 1)
  on conflict (day, path)
  do update set views = page_views.views + 1;
$$;

revoke all on function public.increment_page_view(date, text) from public;
grant execute on function public.increment_page_view(date, text) to service_role;
