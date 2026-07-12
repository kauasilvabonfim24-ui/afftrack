create table if not exists app_config (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value text not null,
  description text,
  created_at timestamptz default now()
);

alter table app_config enable row level security;
create policy "allow all app_config" on app_config for all using (true) with check (true);