-- Offener Upload: Für einen vom Admin festgelegten Zeitraum darf jeder ohne
-- Account Sticker hochladen. Der Finder-Name landet dann in legacy_finder_name
-- (uploader_id bleibt NULL) und kann später per Admin-Merge einem Account
-- zugeordnet werden. Anonyme Uploads liegen im Storage-Ordner "anon/".

create table upload_settings (
  id int primary key default 1 check (id = 1),  -- genau eine Zeile
  open_until timestamptz                        -- null/Vergangenheit = geschlossen
);

insert into upload_settings (id, open_until) values (1, null);

alter table upload_settings enable row level security;

create policy "upload_settings_select_public"
  on upload_settings for select using (true);

create policy "upload_settings_admin_write"
  on upload_settings for update
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create or replace function open_upload_active() returns boolean
language sql stable security definer as $$
  select coalesce((select open_until > now() from upload_settings where id = 1), false);
$$;

-- STICKERS: anonymer Insert nur im offenen Zeitraum, nur mit Finder-Name.
create policy "stickers_insert_open_upload"
  on stickers for insert
  with check (
    open_upload_active()
    and uploader_id is null
    and is_legacy = false
    and is_hidden = false
    and char_length(trim(legacy_finder_name)) between 1 and 40
  );

-- STORAGE: anonymer Upload nur in den Ordner "anon/" und nur im offenen Zeitraum.
create policy "storage_stickers_upload_open"
  on storage.objects for insert
  with check (
    bucket_id = 'stickers'
    and open_upload_active()
    and (storage.foldername(name))[1] = 'anon'
  );
