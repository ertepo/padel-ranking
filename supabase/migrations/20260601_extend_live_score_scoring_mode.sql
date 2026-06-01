alter table public.live_score
drop constraint if exists live_score_scoring_mode_check;

alter table public.live_score
add constraint live_score_scoring_mode_check
check (
  scoring_mode in (
    'standard',
    'match_tiebreak_third',
    'short_sets_match_tiebreak_third'
  )
);
