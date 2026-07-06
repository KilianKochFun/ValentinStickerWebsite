-- Quiz-Runden ("Seasons"): Alle bisherigen Runs werden Runde 1 (Archiv),
-- neue Runs laufen ab jetzt in Runde 2. Die Anzeige filtert nach Runde.
-- So bleiben die alten Bestenlisten erhalten, aber die aktive Runde startet frisch.
alter table quiz_runs add column round int not null default 1;  -- Bestand -> Runde 1
alter table quiz_runs alter column round set default 2;          -- neue Runs -> Runde 2

create index quiz_runs_round_type_score_idx on quiz_runs (round, quiz_type, score desc);
