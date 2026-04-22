-- Row Level Security für alle Tabellen.
-- Nicht-eingeloggte: nur SELECT auf nicht-hidden Content.
-- Eingeloggte: eigenes Schreiben. Admins: alles.

alter table profiles enable row level security;
alter table invite_codes enable row level security;
alter table stickers enable row level security;
alter table comments enable row level security;

create or replace function is_admin(uid uuid) returns boolean
language sql stable security definer as $$
  select coalesce((select is_admin from profiles where id = uid), false);
$$;

-- PROFILES
create policy "profiles_select_public"
  on profiles for select
  using (true);

create policy "profiles_update_self_or_admin"
  on profiles for update
  using (id = auth.uid() or is_admin(auth.uid()))
  with check (id = auth.uid() or is_admin(auth.uid()));

create policy "profiles_delete_admin"
  on profiles for delete
  using (is_admin(auth.uid()));

-- INVITE CODES (nur Admin direkt; Redeem läuft über Edge Function mit Service Role)
create policy "invite_codes_admin_all"
  on invite_codes for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- STICKERS
create policy "stickers_select_public"
  on stickers for select
  using (is_hidden = false or is_admin(auth.uid()));

create policy "stickers_insert_authenticated"
  on stickers for insert
  with check (
    auth.uid() is not null
    and uploader_id = auth.uid()
    and is_legacy = false
  );

create policy "stickers_update_owner_or_admin"
  on stickers for update
  using (uploader_id = auth.uid() or is_admin(auth.uid()))
  with check (uploader_id = auth.uid() or is_admin(auth.uid()));

create policy "stickers_delete_owner_or_admin"
  on stickers for delete
  using (uploader_id = auth.uid() or is_admin(auth.uid()));

-- COMMENTS
create policy "comments_select_public"
  on comments for select
  using (is_hidden = false or is_admin(auth.uid()));

create policy "comments_insert_authenticated"
  on comments for insert
  with check (auth.uid() is not null and author_id = auth.uid());

create policy "comments_update_owner_or_admin"
  on comments for update
  using (author_id = auth.uid() or is_admin(auth.uid()))
  with check (author_id = auth.uid() or is_admin(auth.uid()));

create policy "comments_delete_owner_or_admin"
  on comments for delete
  using (author_id = auth.uid() or is_admin(auth.uid()));

-- STORAGE: Bucket "stickers" wurde manuell angelegt (public read).
-- Upload-Pfad-Konvention: "{auth.uid()}/{timestamp}-{filename}"
create policy "storage_stickers_public_read"
  on storage.objects for select
  using (bucket_id = 'stickers');

create policy "storage_stickers_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'stickers'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_stickers_delete_owner_or_admin"
  on storage.objects for delete
  using (
    bucket_id = 'stickers'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin(auth.uid())
    )
  );
