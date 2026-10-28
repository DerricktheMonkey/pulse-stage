-- Run once in the SQL Editor of a NEW Supabase project you own.
-- This does not migrate or expose records from the existing Sites database.
begin;
create table public.pulse_songs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 100),
 creator text not null check (char_length(btrim(creator)) between 1 and 50),
 difficulty text not null check (difficulty in ('easy','normal','hard')),
 duration double precision not null check (duration > 0 and duration <= 1200),
 chart jsonb not null,
 note_count integer generated always as (jsonb_array_length(chart->'notes')) stored,
 audio_key text not null unique,
 audio_type text not null check (audio_type like 'audio/%'),
 background_key text unique,
 background_type text,
 shared boolean not null default false,
 ready boolean not null default false,
 created_at timestamptz not null default now(),
 check (audio_key = owner_id::text || '/' || id::text || '/audio'),
 check ((background_key is null) = (background_type is null)),
 check ((background_key is null and background_type is null) or
   (background_key = owner_id::text || '/' || id::text || '/background' and
    (background_type like 'image/%' or background_type like 'video/%') and
    background_type not ilike '%svg%'))
);
create index pulse_songs_owner_created on public.pulse_songs(owner_id,created_at desc);
create index pulse_songs_shared_created on public.pulse_songs(created_at desc) where shared and ready;
alter table public.pulse_songs enable row level security;
revoke all on public.pulse_songs from public, anon, authenticated;
grant select on public.pulse_songs to anon, authenticated;
grant insert(id,owner_id,title,creator,difficulty,duration,chart,audio_key,audio_type,background_key,background_type,shared) on public.pulse_songs to authenticated;
grant update(shared) on public.pulse_songs to authenticated;
grant delete on public.pulse_songs to authenticated;
create policy song_reads on public.pulse_songs for select to anon,authenticated
 using ((ready and shared) or owner_id = (select auth.uid()));
create policy song_inserts on public.pulse_songs for insert to authenticated
 with check (owner_id = (select auth.uid()) and not ready);
create policy song_visibility on public.pulse_songs for update to authenticated
 using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy song_deletes on public.pulse_songs for delete to authenticated
 using (owner_id = (select auth.uid()));

-- Validate charts and cap each account at 40 records, including unfinished uploads.
-- Advisory locking makes the limit hold for concurrent upload requests too.
create function public.validate_pulse_song() returns trigger language plpgsql
 security definer set search_path = '' as $$
declare n jsonb; t numeric; d numeric; lane integer; ends numeric[] := array[-1,-1,-1,-1];
begin
 if tg_op = 'INSERT' then
   if auth.uid() is null or new.owner_id <> auth.uid() then raise exception 'Sign in to upload your own songs'; end if;
   perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
   if (select count(*) from public.pulse_songs where owner_id=new.owner_id) >= 40 then raise exception 'Your library holds 40 songs; delete an older song first'; end if;
 else
   if new.id <> old.id or new.owner_id <> old.owner_id then raise exception 'Song ownership cannot change'; end if;
   if new.chart is not distinct from old.chart then return new; end if;
 end if;
 if jsonb_typeof(new.chart) <> 'object' or jsonb_typeof(new.chart->'notes') is distinct from 'array' or
    jsonb_array_length(new.chart->'notes') not between 1 and 30000 or octet_length(new.chart::text)>2000000 then
   raise exception 'Chart must contain 1 to 30000 notes and fit within 2 MB';
 end if;
 if new.chart ? 'rating' and new.chart->'rating' <> 'null'::jsonb then
   if jsonb_typeof(new.chart->'rating') <> 'number' or (new.chart->>'rating')::numeric not between 1 and 40 or
      mod((new.chart->>'rating')::numeric,1)<>0 then raise exception 'Level rating must be 1 to 40'; end if;
 end if;
 if new.chart ? 'offsetMs' and (jsonb_typeof(new.chart->'offsetMs') <> 'number' or
    (new.chart->>'offsetMs')::numeric not between -1000 and 1000) then raise exception 'Invalid chart offset'; end if;
 for n in select value from jsonb_array_elements(new.chart->'notes') loop
   if jsonb_typeof(n->'time') is distinct from 'number' or jsonb_typeof(n->'lane') is distinct from 'number' or
      (n ? 'duration' and jsonb_typeof(n->'duration') <> 'number') then raise exception 'Invalid note fields'; end if;
   if (n->>'lane')::numeric not between 0 and 3 or mod((n->>'lane')::numeric,1)<>0 then raise exception 'Invalid lane'; end if;
   t := (n->>'time')::numeric; d := coalesce((n->>'duration')::numeric,0);
   if t<0 or t>new.duration or d<0 or t+d>new.duration+.01 then raise exception 'Note outside song'; end if;
 end loop;
 for n in select value from jsonb_array_elements(new.chart->'notes') order by (value->>'time')::numeric,(value->>'lane')::numeric loop
   t := (n->>'time')::numeric; d := coalesce((n->>'duration')::numeric,0); lane := (n->>'lane')::integer+1;
   if t < ends[lane]-.001 then raise exception 'Notes cannot overlap in one lane'; end if;
   ends[lane] := t+greatest(.035,d);
 end loop;
 return new;
end $$;
revoke all on function public.validate_pulse_song() from public,anon,authenticated;
create trigger validate_pulse_song before insert or update on public.pulse_songs
 for each row execute function public.validate_pulse_song();

-- Every file stays in a private bucket. Public access is granted only while its song is shared.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('pulse-stage-media','pulse-stage-media',false,52428800,
 array['audio/*','video/*','image/png','image/jpeg','image/webp','image/gif','image/avif','image/bmp']);
create policy pulse_media_reads on storage.objects for select to anon,authenticated using (
 bucket_id='pulse-stage-media' and exists(select 1 from public.pulse_songs s
 where (s.audio_key=name or s.background_key=name) and
 ((s.ready and s.shared) or s.owner_id=(select auth.uid())))
);
create policy pulse_media_uploads on storage.objects for insert to authenticated with check (
 bucket_id='pulse-stage-media' and exists(select 1 from public.pulse_songs s
 where s.owner_id=(select auth.uid()) and not s.ready and (s.audio_key=name or s.background_key=name))
);
create policy pulse_media_deletes on storage.objects for delete to authenticated using (
 bucket_id='pulse-stage-media' and exists(select 1 from public.pulse_songs s
 where s.owner_id=(select auth.uid()) and (s.audio_key=name or s.background_key=name))
);
-- No object UPDATE policy: finalized media cannot be overwritten under an existing shared URL.
create function public.finalize_pulse_song(song_id uuid) returns uuid
 language plpgsql security definer set search_path = '' as $$
declare s public.pulse_songs; a jsonb; b jsonb; max_background bigint;
begin
 select * into s from public.pulse_songs where id=song_id for update;
 if not found or auth.uid() is null or s.owner_id<>auth.uid() then raise exception 'Only the creator may complete this upload'; end if;
 select metadata into a from storage.objects where bucket_id='pulse-stage-media' and name=s.audio_key;
 if a is null or (a->>'size') is null or (a->>'size')::bigint not between 1 and 26214400 or
    a->>'mimetype' is distinct from s.audio_type then raise exception 'Upload the matching audio file (up to 25 MB) first'; end if;
 if s.background_key is not null then
   select metadata into b from storage.objects where bucket_id='pulse-stage-media' and name=s.background_key;
   max_background := 52428800;
   if b is null or (b->>'size') is null or (b->>'size')::bigint not between 1 and max_background or
      b->>'mimetype' is distinct from s.background_type then raise exception 'Upload the matching background first (images and videos 50 MB)'; end if;
 end if;
 update public.pulse_songs set ready=true where id=s.id;
 return s.id;
end $$;
revoke all on function public.finalize_pulse_song(uuid) from public,anon;
grant execute on function public.finalize_pulse_song(uuid) to authenticated;
commit;
