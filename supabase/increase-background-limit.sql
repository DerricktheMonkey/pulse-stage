-- Run in your EXISTING Supabase project's SQL Editor.
-- Keeps all songs, files, ownership rules and the 25 MB audio limit.
begin;
do $$
begin
 if to_regclass('public.pulse_songs') is null then
   raise exception 'Run supabase/setup.sql first: the song table is missing';
 end if;
 if not exists(select 1 from storage.buckets where id='pulse-stage-media') then
   raise exception 'Run supabase/setup.sql first: the media bucket is missing';
 end if;
end $$;
update storage.buckets set file_size_limit=52428800 where id='pulse-stage-media';
create or replace function public.finalize_pulse_song(song_id uuid) returns uuid
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
