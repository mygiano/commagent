-- ============================================================
-- Covert Chat — Supabase schema (FRESH INSTALL)
-- Jalankan seluruh isi file ini di Supabase: SQL Editor > New query > Run
--
-- Kalau project Supabase kamu SUDAH pernah dijalankan skrip versi lama
-- (tanpa fitur foto/dokumen), JANGAN jalankan file ini — jalankan
-- "supabase-migration-files.sql" saja, itu cukup untuk menambahkan
-- fitur baru tanpa mengubah data yang sudah ada.
--
-- PENTING: sebelum menjalankan file ini, aktifkan dulu extension
-- "pg_cron" lewat Supabase Dashboard > Database > Extensions > cari
-- "pg_cron" > Enable. Kalau belum, bagian penjadwalan di paling bawah
-- akan gagal.
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
  text text not null default '',
  reply_to jsonb,
  file_url text,
  file_name text,
  file_type text,
  file_size bigint,
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
drop policy if exists "public read agents" on agents;
create policy "public read agents" on agents for select using (true);
drop policy if exists "public write agents" on agents;
create policy "public write agents" on agents for insert with check (true);
drop policy if exists "public update agents" on agents;
create policy "public update agents" on agents for update using (true);
drop policy if exists "public delete agents" on agents;
create policy "public delete agents" on agents for delete using (true);

drop policy if exists "public read messages" on messages;
create policy "public read messages" on messages for select using (true);
drop policy if exists "public write messages" on messages;
create policy "public write messages" on messages for insert with check (true);
drop policy if exists "public update messages" on messages;
create policy "public update messages" on messages for update using (true);
drop policy if exists "public delete messages" on messages;
create policy "public delete messages" on messages for delete using (true);

-- Bucket penyimpanan untuk lampiran foto/dokumen
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-files', 'chat-files', true, 10485760) -- 10MB per file
on conflict (id) do nothing;

drop policy if exists "chat-files public insert" on storage.objects;
create policy "chat-files public insert"
on storage.objects for insert
to public
with check (bucket_id = 'chat-files');

drop policy if exists "chat-files public select" on storage.objects;
create policy "chat-files public select"
on storage.objects for select
to public
using (bucket_id = 'chat-files');

drop policy if exists "chat-files public delete" on storage.objects;
create policy "chat-files public delete"
on storage.objects for delete
to public
using (bucket_id = 'chat-files');

-- Fungsi pembersihan otomatis: hapus file yang lebih tua dari 30 hari
create or replace function delete_expired_attachments() returns void as $$
begin
  delete from storage.objects
  where bucket_id = 'chat-files'
    and created_at < now() - interval '30 days';

  update messages
  set file_url = null
  where file_url is not null
    and created_at < now() - interval '30 days';
end;
$$ language plpgsql security definer;

-- Jadwalkan otomatis jalan tiap hari jam 03:00 UTC
select cron.schedule(
  'delete-expired-attachments-daily',
  '0 3 * * *',
  $$select delete_expired_attachments();$$
);

-- Aktifkan realtime (agar pesan/agen baru langsung muncul tanpa refresh)
alter publication supabase_realtime add table agents;
alter publication supabase_realtime add table messages;
