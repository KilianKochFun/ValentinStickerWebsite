-- Valentinsticker.de Schema
-- Checkpoint 1: Aachen Mitte [50.7753, 6.0839] = Entfernungs-Anker (clientseitig)
-- Ein Bild pro Sticker. Uploader darf editieren. Legacy-Merge via UI-Vorschlag.
-- Account-Löschung: anonymisiert (author_id / uploader_id = NULL, Body/Bild bleibt).

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null unique,
  created_at timestamptz not null default now(),
  is_admin boolean not null default false
);

create table invite_codes (
  code text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by uuid references auth.users on delete set null,
  used_at timestamptz,
  note text
);

-- is_legacy: image_path zeigt auf Repo (img/StickerFunde/...) statt Storage.
-- uploader_id: registrierter User (kann auch bei is_legacy=true gesetzt sein,
--   wenn Legacy-Finder später einem Account zugeordnet wurde).
-- legacy_finder_name: Anzeigename, wenn kein uploader_id gesetzt ist.
create table stickers (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid references auth.users on delete set null,
  legacy_finder_name text,
  image_path text not null,
  is_legacy boolean not null default false,
  title text,
  description text,
  latitude double precision,
  longitude double precision,
  country_code text,
  continent text,
  found_at timestamptz,
  created_at timestamptz not null default now(),
  is_hidden boolean not null default false,
  constraint stickers_has_finder check (
    uploader_id is not null or legacy_finder_name is not null
  )
);

create index stickers_found_at_idx on stickers (found_at desc);
create index stickers_uploader_idx on stickers (uploader_id);
create unique index stickers_legacy_image_idx on stickers (image_path) where is_legacy = true;

create table comments (
  id uuid primary key default gen_random_uuid(),
  sticker_id uuid not null references stickers on delete cascade,
  author_id uuid references auth.users on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  is_hidden boolean not null default false
);

create index comments_sticker_idx on comments (sticker_id, created_at);
