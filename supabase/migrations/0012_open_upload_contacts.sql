-- Offener Upload mit Name + E-Mail.
-- Die E-Mail ist nicht öffentlich und liegt deshalb in einer eigenen, nur für
-- Admins lesbaren Tabelle (stickers ist öffentlich lesbar). Anonyme Uploads
-- laufen nur noch über die RPC submit_open_upload, die Sticker und Kontakt
-- gemeinsam anlegt – ein direkter anonymer Insert in stickers ist nicht mehr erlaubt.

drop policy "stickers_insert_open_upload" on stickers;

create table open_upload_contacts (
  sticker_id uuid primary key references stickers on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table open_upload_contacts enable row level security;

create policy "open_upload_contacts_admin_all"
  on open_upload_contacts for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create or replace function submit_open_upload(
  p_image_path text,
  p_title text,
  p_description text,
  p_latitude double precision,
  p_longitude double precision,
  p_country_code text,
  p_continent text,
  p_found_at timestamptz,
  p_finder_name text,
  p_email text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_name text := trim(p_finder_name);
  v_mail text := lower(trim(p_email));
begin
  if not open_upload_active() then
    raise exception 'Der offene Upload ist gerade nicht aktiv.';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'Bitte einen Namen (max. 40 Zeichen) angeben.';
  end if;
  if v_mail is null or char_length(v_mail) > 254 or v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Bitte eine gültige E-Mail-Adresse angeben.';
  end if;
  -- Nur frisch hochgeladene Dateien aus dem anon-Ordner, die noch keinem Sticker gehören.
  if p_image_path is null or p_image_path !~ '^anon/[^/]+$'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'stickers' and o.name = p_image_path)
     or exists (select 1 from stickers s where s.image_path = p_image_path) then
    raise exception 'Ungültige Datei.';
  end if;

  insert into stickers (
    uploader_id, legacy_finder_name, image_path, is_legacy, title, description,
    latitude, longitude, country_code, continent, found_at
  ) values (
    null, v_name, p_image_path, false, left(p_title, 120), left(p_description, 500),
    p_latitude, p_longitude, p_country_code, p_continent, coalesce(p_found_at, now())
  ) returning id into v_id;

  insert into open_upload_contacts (sticker_id, email) values (v_id, v_mail);
  return v_id;
end; $$;

revoke all on function submit_open_upload(text, text, text, double precision, double precision, text, text, timestamptz, text, text) from public;
grant execute on function submit_open_upload(text, text, text, double precision, double precision, text, text, timestamptz, text, text) to anon, authenticated;
