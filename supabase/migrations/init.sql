create table if not exists links (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  url text not null,
  short text unique not null,
  platform text not null,
  product_value numeric not null default 0,
  commission numeric not null default 0,
  value_per_click numeric not null default 0,
  clicks integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists click_events (
  id uuid default gen_random_uuid() primary key,
  link_id uuid references links(id) on delete cascade,
  clicked_at timestamptz default now(),
  referrer text
);

alter table links enable row level security;
alter table click_events enable row level security;
create policy "allow all links" on links for all using (true) with check (true);
create policy "allow all clicks" on click_events for all using (true) with check (true);
alter publication supabase_realtime add table links;
alter publication supabase_realtime add table click_events;
