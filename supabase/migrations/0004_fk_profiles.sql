-- PostgREST kann FK-basierte Joins nur auflösen, wenn die FK innerhalb des
-- public-Schemas zeigt. Ursprünglich zeigten uploader_id / author_id auf
-- auth.users. Wir hängen sie an profiles(id) um (gleiche UUID, weil profiles.id
-- selbst auf auth.users referenziert).

alter table stickers drop constraint if exists stickers_uploader_id_fkey;
alter table stickers
  add constraint stickers_uploader_id_fkey
  foreign key (uploader_id) references profiles(id) on delete set null;

alter table comments drop constraint if exists comments_author_id_fkey;
alter table comments
  add constraint comments_author_id_fkey
  foreign key (author_id) references profiles(id) on delete set null;

-- PostgREST-Schema-Cache neu laden, damit die neuen Relationen sofort greifen.
notify pgrst, 'reload schema';
