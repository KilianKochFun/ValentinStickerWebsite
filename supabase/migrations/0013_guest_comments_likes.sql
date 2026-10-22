-- Kommentare und Likes auch ohne Account.
-- Kommentare: Gäste geben nur einen Namen an (guest_name), angezeigt als "Name (Gast)".
-- Likes: ein Like pro Browser. Der Browser erzeugt ein zufälliges Geheimnis
--   (localStorage); gespeichert wird nur dessen SHA-256 (guest_hash), damit
--   niemand fremde Gast-Likes entfernen kann. Setzen/Entfernen nur per RPC.

-- KOMMENTARE
alter table comments add column guest_name text;

create policy "comments_insert_guest"
  on comments for insert
  with check (
    author_id is null
    and is_hidden = false
    and char_length(trim(guest_name)) between 1 and 40
    and char_length(trim(body)) between 1 and 1000
  );

-- LIKES: user_id oder guest_hash, je Sticker höchstens ein Like pro Besitzer.
alter table sticker_likes drop constraint sticker_likes_pkey;
alter table sticker_likes alter column user_id drop not null;
alter table sticker_likes add column id uuid primary key default gen_random_uuid();
alter table sticker_likes add column guest_hash text;
alter table sticker_likes add constraint sticker_likes_one_owner
  check (num_nonnulls(user_id, guest_hash) = 1);

create unique index sticker_likes_user_uniq on sticker_likes (sticker_id, user_id) where user_id is not null;
create unique index sticker_likes_guest_uniq on sticker_likes (sticker_id, guest_hash) where guest_hash is not null;

create or replace function guest_like_set(p_sticker_id uuid, p_secret text, p_like boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
begin
  if p_secret is null or char_length(p_secret) not between 20 and 100 then
    raise exception 'Ungültige Gast-Kennung.';
  end if;
  if not exists (select 1 from stickers where id = p_sticker_id and is_hidden = false) then
    raise exception 'Sticker nicht gefunden.';
  end if;
  v_hash := encode(sha256(convert_to(p_secret, 'UTF8')), 'hex');
  if p_like then
    insert into sticker_likes (sticker_id, guest_hash) values (p_sticker_id, v_hash)
    on conflict do nothing;
  else
    delete from sticker_likes where sticker_id = p_sticker_id and guest_hash = v_hash;
  end if;
end; $$;

revoke all on function guest_like_set(uuid, text, boolean) from public;
grant execute on function guest_like_set(uuid, text, boolean) to anon, authenticated;
