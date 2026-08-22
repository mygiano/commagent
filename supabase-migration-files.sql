-- ============================================================
-- Covert Chat — Migration: file attachments + 30-day auto-delete
-- Jalankan di Supabase: SQL Editor > New query > Run
-- (Aman dijalankan meski sebagian sudah ada, pakai IF NOT EXISTS)
-- ============================================================

-- 1) Kolom baru di tabel messages untuk lampiran file
alter table messages add column if not exists file_url text;
alter table messages add column if not exists file_name text;
alter table messages add column if not exists file_type text;
alter table messages add column if not exists file_size bigint;

-- 2) Buat bucket penyimpanan "chat-files"
--    CATATAN: bucket ini dibuat PUBLIC agar gampang ditampilkan (foto/dokumen
--    bisa diakses lewat URL langsung) — sama seperti tingkat keamanan
--    prototype yang sudah kita pakai sejauh ini (bukan untuk data rahasia
--    sungguhan). Jalankan baris ini, atau buat manual lewat
--    Storage > New bucket > nama "chat-files" > Public: ON.
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', true)
on conflict (id) do nothing;

-- Izinkan siapa pun (pemegang anon key) upload & lihat & hapus file di bucket ini
create policy if not exists "chat-files public insert"
on storage.objects for insert
to public
with check (bucket_id = 'chat-files');

create policy if not exists "chat-files public select"
on storage.objects for select
to public
using (bucket_id = 'chat-files');

create policy if not exists "chat-files public delete"
on storage.objects for delete
to public
using (bucket_id = 'chat-files');

-- 3) Fungsi pembersihan otomatis: hapus file yang lebih tua dari 30 hari
create or replace function delete_expired_attachments() returns void as $$
begin
  -- hapus file fisik dari storage
  delete from storage.objects
  where bucket_id = 'chat-files'
    and created_at < now() - interval '30 days';

  -- kosongkan link file di pesan (teks pesan & riwayat tetap ada,
  -- cuma lampirannya yang hilang)
  update messages
  set file_url = null
  where file_url is not null
    and created_at < now() - interval '30 days';
end;
$$ language plpgsql security definer;

-- 4) Jadwalkan otomatis jalan tiap hari jam 03:00 UTC
--    PENTING: sebelum baris ini, aktifkan dulu extension "pg_cron" lewat
--    Supabase Dashboard > Database > Extensions > cari "pg_cron" > Enable.
--    Kalau belum diaktifkan, baris di bawah ini akan gagal.
select cron.schedule(
  'delete-expired-attachments-daily',
  '0 3 * * *',
  $$select delete_expired_attachments();$$
);
