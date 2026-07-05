-- Likes/Reaktionen pro Sticker. Genau ein Like pro (Sticker, User).
-- Anonyme dürfen die Anzahl sehen; eingeloggte setzen/entfernen nur ihr eigenes Like.

create table sticker_likes (
  sticker_id uuid not null references stickers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sticker_id, user_id)
);

create index sticker_likes_sticker_idx on sticker_likes (sticker_id);

alter table sticker_likes enable row level security;

-- Jeder darf Likes sehen/zählen.
create policy "sticker_likes_select_public"
  on sticker_likes for select
  using (true);

-- Eingeloggte dürfen nur ihr eigenes Like setzen.
create policy "sticker_likes_insert_own"
  on sticker_likes for insert
  with check (auth.uid() is not null and user_id = auth.uid());

-- Und nur ihr eigenes Like wieder entfernen.
create policy "sticker_likes_delete_own"
  on sticker_likes for delete
  using (user_id = auth.uid());
