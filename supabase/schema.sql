-- Run once in Supabase SQL Editor. Safe to run again.
begin;

create table if not exists public.shares (
  id uuid primary key,
  storage_path text not null unique,
  filename text not null check (char_length(filename) between 1 and 180),
  kind text not null check (kind in ('file', 'text')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  status text not null default 'pending' check (status in ('pending', 'ready', 'deleted')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists shares_created_at_idx on public.shares(created_at desc);
create index if not exists shares_expires_at_idx on public.shares(expires_at) where expires_at is not null;
alter table public.shares enable row level security;
-- Only server-side service role may read/write metadata. No public policies.
revoke all on public.shares from anon, authenticated;
grant select, insert, update, delete on public.shares to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('shares', 'shares', false, 5242880)
on conflict (id) do update set public = false, file_size_limit = 5242880;
-- Keep this bucket private; do not add anon/authenticated Storage policies.
-- The server issues short-lived signed upload and download URLs.
commit;
