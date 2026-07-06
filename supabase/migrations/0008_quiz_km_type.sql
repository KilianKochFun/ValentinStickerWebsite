-- Neuer Quiz-Typ: exakte km-Entfernung zur Aachener Mitte schätzen.
-- Wird nur hinzugefügt (nicht in dieser Migration verwendet), daher auf PG15 unkritisch.
alter type quiz_type add value if not exists 'distance_km';
