-- Views für Ranglisten.
-- Entfernungs-Rangliste wird clientseitig (Haversine gegen Aachen Mitte) berechnet,
-- daher hier nur Finder- und Kontinent-Übersicht.

create or replace view finder_ranking as
select
  coalesce(p.display_name, s.legacy_finder_name) as finder_name,
  p.id as user_id,
  count(*) as sticker_count,
  min(s.found_at) as first_find,
  max(s.found_at) as last_find
from stickers s
left join profiles p on p.id = s.uploader_id
where s.is_hidden = false
group by coalesce(p.display_name, s.legacy_finder_name), p.id
order by sticker_count desc;

create or replace view continent_stats as
select continent, count(*) as sticker_count
from stickers
where continent is not null and is_hidden = false
group by continent
order by sticker_count desc;
