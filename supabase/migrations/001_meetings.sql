-- Meetings table for recording metadata and transcript/summary
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  transcript text,
  summary text,
  audio_path text,
  user_id uuid references auth.users(id) on delete set null
);

-- RLS: enable and allow anon to read/insert (app uses anon key; optionally restrict by user_id later)
alter table public.meetings enable row level security;

-- Allow anonymous insert for app (no auth required per PRD; can tighten with auth.uid() later)
create policy "Allow anon insert meetings"
  on public.meetings for insert
  to anon with check (true);

-- Allow anonymous select so app can list and show meeting detail
create policy "Allow anon select meetings"
  on public.meetings for select
  to anon using (true);

-- Service role can update (backend uses service role to set transcript/summary/status)
create policy "Allow service update meetings"
  on public.meetings for update
  to service_role using (true)
  with check (true);

-- Optional: trigger to keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
create trigger meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();
