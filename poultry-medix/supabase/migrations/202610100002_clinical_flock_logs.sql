create table if not exists public.clinical_flock_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flock_label text not null check (char_length(trim(flock_label)) between 1 and 120),
  species text not null default 'Chicken',
  bird_count integer check (bird_count is null or bird_count between 1 and 1000000),
  observed_on date not null default current_date,
  signs text not null check (char_length(trim(signs)) between 1 and 5000),
  outcome text not null default '',
  veterinarian_notes text not null default '' check (char_length(veterinarian_notes) <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists clinical_flock_logs_owner_observed_idx
  on public.clinical_flock_logs (user_id, observed_on desc, created_at desc);

alter table public.clinical_flock_logs enable row level security;

create policy "Farmers manage their own flock logs"
  on public.clinical_flock_logs for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.clinical_flock_logs to authenticated;
