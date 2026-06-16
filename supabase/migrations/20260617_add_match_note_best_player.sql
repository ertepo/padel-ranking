alter table public.matches
add column if not exists note text,
add column if not exists best_player_id uuid;

alter table public.tennis_matches
add column if not exists note text,
add column if not exists best_player_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_best_player_id_fkey'
  ) then
    alter table public.matches
    add constraint matches_best_player_id_fkey
    foreign key (best_player_id)
    references public.players(id)
    on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tennis_matches_best_player_id_fkey'
  ) then
    alter table public.tennis_matches
    add constraint tennis_matches_best_player_id_fkey
    foreign key (best_player_id)
    references public.players(id)
    on delete set null;
  end if;
end $$;
