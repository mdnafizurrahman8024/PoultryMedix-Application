create table if not exists public.prescription_analysis_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(file_name) <= 255),
  image_path text not null,
  image_url text,
  transcription text not null default '' check (char_length(transcription) <= 12000),
  medicines jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists prescription_analysis_logs_owner_created_idx
  on public.prescription_analysis_logs (user_id, created_at desc);

alter table public.prescription_analysis_logs enable row level security;

create policy "Users read their own prescription analyses"
  on public.prescription_analysis_logs for select to authenticated
  using (auth.uid() = user_id);

create policy "Users save their own prescription analyses"
  on public.prescription_analysis_logs for insert to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.prescription_analysis_logs to authenticated;
