-- ============================================================
-- Covert Chat — Supabase schema
-- Jalankan seluruh isi file ini di Supabase: SQL Editor > New query > Run
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  sender text not null check (sender in ('admin', 'agent')),
  text text not null,
  reply_to jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_agent_id_idx on messages(agent_id);

-- Row Level Security
alter table agents enable row level security;
alter table messages enable row level security;

-- NOTE (baca ini): kebijakan di bawah mengizinkan akses penuh (baca/tulis)
-- ke siapa pun yang punya "anon key" milikmu — dan anon key itu memang
-- tertanam di kode frontend yang di-deploy, jadi siapa pun yang membuka
-- website bisa melihatnya lewat DevTools browser. Ini cukup untuk PROTOTYPE,
-- tapi bukan keamanan sungguhan. Untuk produksi asli, logika verifikasi kode
-- agen & password admin sebaiknya dipindah ke Supabase Edge Function /
-- server, bukan dicek di browser.
create policy "public read agents" on agents for select using (true);
create policy "public write agents" on agents for insert with check (true);
create policy "public update agents" on agents for update using (true);
create policy "public delete agents" on agents for delete using (true);

create policy "public read messages" on messages for select using (true);
create policy "public write messages" on messages for insert with check (true);
create policy "public update messages" on messages for update using (true);
create policy "public delete messages" on messages for delete using (true);

-- Aktifkan realtime (agar pesan/agen baru langsung muncul tanpa refresh)
alter publication supabase_realtime add table agents;
alter publication supabase_realtime add table messages;
