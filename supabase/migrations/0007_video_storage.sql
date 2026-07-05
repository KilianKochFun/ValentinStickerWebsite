-- Videos im Storage erlauben: Größenlimit auf 15 MB anheben und Video-MIME-Typen
-- zusätzlich zu den Bildformaten zulassen. Der Bucket "stickers" existiert bereits.
-- (Bilder werden clientseitig weiterhin auf 5 MB begrenzt, Videos auf 15 MB / 30 s.)

update storage.buckets
set
  file_size_limit = 15728640,  -- 15 MB
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
where id = 'stickers';
