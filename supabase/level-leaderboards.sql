-- Run once in the Supabase SQL editor for the existing Pulse Stage project.
-- Does not change song/storage policies. Never put a service-role key in the game.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.pulse_level_scores (
 song_id uuid not null references public.pulse_songs(id) on delete cascade,
 player_id uuid not null references auth.users(id) on delete cascade,
 chart_hash text not null,
 display_name text not null check (length(display_name) between 1 and 24),
 score integer not null check (score>=0),
 accuracy numeric not null check (accuracy between 0 and 100),
 max_combo integer not null check (max_combo>=0),
 note_count integer not null check (note_count between 1 and 30000),
 created_at timestamptz not null default now(),
 primary key(song_id,player_id,chart_hash)
);
alter table public.pulse_level_scores enable row level security;
revoke all on public.pulse_level_scores from anon, authenticated;

create or replace function public.pulse_chart_hash(chart jsonb, difficulty text)
returns text language sql immutable set search_path=public,extensions as $$
 select encode(extensions.digest('ordered-perfect-v1|'||difficulty||'|['||coalesce(string_agg(
 '['||floor((n->>'time')::numeric*1000000+0.5)::bigint||','||(n->>'lane')::integer||','||floor(coalesce((n->>'duration')::numeric,0)*1000000+0.5)::bigint||']',',' order by ordinal),'')||']','sha256'),'hex')
 from jsonb_array_elements(chart->'notes') with ordinality as notes(n,ordinal);
$$;

create or replace function public.pulse_level_leaderboard(song_id uuid, chart_hash text)
returns table(display_name text,score integer,accuracy numeric,max_combo integer,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select r.display_name,r.score,r.accuracy,r.max_combo,r.created_at
 from pulse_level_scores r join pulse_songs s on s.id=r.song_id
 where s.id=$1 and s.shared and s.ready and r.chart_hash=$2
 order by r.score desc,r.max_combo desc,r.created_at asc limit 50;
$$;

create or replace function public.pulse_submit_score(song_id uuid,chart_hash text,display_name text,grades jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare s pulse_songs%rowtype; total integer; g text; value integer; points integer:=0; combo integer:=0; best integer:=0; uid uuid:=auth.uid(); diff text;
begin
 if uid is null then raise exception 'Sign in to submit a score.'; end if;
 if length(trim($3)) not between 1 and 24 then raise exception 'Name must be 1–24 characters.'; end if;
 select * into s from pulse_songs where id=$1 and shared and ready;
 if not found then raise exception 'This level is no longer published.'; end if;
 diff:=coalesce(s.chart->>'difficulty',s.difficulty);
 if public.pulse_chart_hash(s.chart,diff)<>$2 then raise exception 'Play the original published chart and difficulty to rank on this board.'; end if;
 total:=jsonb_array_length(s.chart->'notes');
 if total not between 1 and 30000 or jsonb_typeof($4) is distinct from 'array' or jsonb_array_length($4)<>total then raise exception 'Only a completed run can rank.'; end if;
 for g in select jsonb_array_elements_text($4) loop
  value:=case g when 'PERFECT' then 1000 when 'GREAT' then 800 when 'GOOD' then 500 when 'MISS' then 0 else -1 end;
  if value<0 then raise exception 'Invalid judgement.'; end if;
  points:=points+value;combo:=case when g='PERFECT' then combo+1 else 0 end;best:=greatest(best,combo);
 end loop;
 insert into pulse_level_scores as old(song_id,player_id,chart_hash,display_name,score,accuracy,max_combo,note_count)
 values($1,uid,$2,trim($3),points,points::numeric/total/10,best,total)
 on conflict on constraint pulse_level_scores_pkey do update set display_name=excluded.display_name,score=excluded.score,accuracy=excluded.accuracy,max_combo=excluded.max_combo,note_count=excluded.note_count,created_at=now()
 where excluded.score>old.score or (excluded.score=old.score and excluded.max_combo>old.max_combo);
end;
$$;
revoke all on function public.pulse_chart_hash(jsonb,text) from public;
revoke all on function public.pulse_level_leaderboard(uuid,text) from public;
revoke all on function public.pulse_submit_score(uuid,text,text,jsonb) from public;
grant execute on function public.pulse_level_leaderboard(uuid,text) to anon,authenticated;
grant execute on function public.pulse_submit_score(uuid,text,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
