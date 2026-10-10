create table if not exists public.clinical_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (topic in (
    'Clinical Signs & Symptoms',
    'Post-mortem Findings',
    'Antibiotic Prescribing Patterns',
    'Treatment Failure & Drug Efficacy Logs',
    'Bacterial Culture & AST Results',
    'Farmer Self-Medication / OTC Usage',
    'Withdrawal Period Compliance'
  )),
  notes text not null default '' check (char_length(notes) <= 5000),
  attachment_paths text[] not null default '{}',
  antibiotic_class text,
  antibiotic_name text,
  antibiotic_generation text,
  latitude double precision,
  longitude double precision,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  constraint clinical_submissions_location_pair check (
    (latitude is null and longitude is null)
    or (
      latitude is not null
      and longitude is not null
      and
      latitude between -90 and 90
      and longitude between -180 and 180
      and latitude = round(latitude::numeric, 2)::double precision
      and longitude = round(longitude::numeric, 2)::double precision
    )
  )
);

create index if not exists clinical_submissions_owner_created_idx
  on public.clinical_submissions (user_id, created_at desc);
create index if not exists clinical_submissions_amr_verified_idx
  on public.clinical_submissions (status, antibiotic_class, antibiotic_name)
  where status = 'verified';

alter table public.clinical_submissions enable row level security;

create policy "Users create their own clinical submissions"
  on public.clinical_submissions for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

create policy "Users and DLS officers read authorized submissions"
  on public.clinical_submissions for select to authenticated
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('dls_officer', 'vet_officer')
  );

create policy "DLS officers review submissions"
  on public.clinical_submissions for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('dls_officer', 'vet_officer'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('dls_officer', 'vet_officer'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-submissions',
  'clinical-submissions',
  false,
  8388608,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'audio/aac', 'audio/flac', 'audio/mp3', 'audio/m4a', 'audio/mp4', 'audio/mpeg',
    'audio/mpga', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/webm',
    'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload their own clinical attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clinical-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read their own attachments and DLS reads submissions"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clinical-submissions'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (auth.jwt() -> 'app_metadata' ->> 'role') in ('dls_officer', 'vet_officer')
    )
  );

create policy "Users remove their own clinical attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'clinical-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.get_amr_analytics()
returns table (
  antibiotic_class text,
  antibiotic_name text,
  antibiotic_generation text,
  report_count bigint,
  usage_ratio numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with totals as (
    select count(*)::numeric as total
    from public.clinical_submissions
    where status = 'verified'
      and nullif(trim(antibiotic_class), '') is not null
      and nullif(trim(antibiotic_name), '') is not null
  ),
  grouped as (
    select
      trim(s.antibiotic_class) as drug_class,
      trim(s.antibiotic_name) as drug_name,
      coalesce(nullif(trim(s.antibiotic_generation), ''), 'Not recorded') as drug_generation,
      count(*)::bigint as reports,
      count(distinct s.user_id)::bigint as contributors
    from public.clinical_submissions s
    where s.status = 'verified'
      and nullif(trim(s.antibiotic_class), '') is not null
      and nullif(trim(s.antibiotic_name), '') is not null
    group by 1, 2, 3
  )
  select g.drug_class, g.drug_name, g.drug_generation, g.reports,
         case when t.total = 0 then 0 else round(g.reports * 100 / t.total, 1) end
  from grouped g
  cross join totals t
  where g.contributors >= 5
  order by g.reports desc, g.drug_class, g.drug_name;
$$;

create or replace function public.get_amr_map_points()
returns table (
  latitude double precision,
  longitude double precision,
  antibiotic_class text,
  antibiotic_name text,
  antibiotic_generation text,
  report_count bigint,
  contributor_count bigint,
  usage_ratio numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with grouped as (
    select
      round(s.latitude::numeric, 2)::double precision as lat,
      round(s.longitude::numeric, 2)::double precision as lon,
      trim(s.antibiotic_class) as drug_class,
      trim(s.antibiotic_name) as drug_name,
      coalesce(nullif(trim(s.antibiotic_generation), ''), 'Not recorded') as drug_generation,
      count(*)::bigint as reports,
      count(distinct s.user_id)::bigint as contributors
    from public.clinical_submissions s
    where s.status = 'verified'
      and s.latitude is not null
      and s.longitude is not null
      and nullif(trim(s.antibiotic_class), '') is not null
      and nullif(trim(s.antibiotic_name), '') is not null
    group by 1, 2, 3, 4, 5
  ),
  with_totals as (
    select g.*,
      sum(g.reports) over (partition by g.lat, g.lon) as location_total
    from grouped g
  )
  select w.lat, w.lon, w.drug_class, w.drug_name, w.drug_generation,
         w.reports, w.contributors,
         round(w.reports::numeric * 100 / nullif(w.location_total, 0), 1)
  from with_totals w
  where w.contributors >= 5
  order by w.reports desc;
$$;

revoke all on function public.get_amr_analytics() from public;
revoke all on function public.get_amr_map_points() from public;
grant execute on function public.get_amr_analytics() to authenticated;
grant execute on function public.get_amr_map_points() to authenticated;

grant select, insert, update (status) on public.clinical_submissions to authenticated;
