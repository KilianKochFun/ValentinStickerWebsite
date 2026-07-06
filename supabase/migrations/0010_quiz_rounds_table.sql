-- Verwaltbare Quiz-Runden: aktive Runde liegt in der DB (nicht mehr im Client).
-- Admins können per RPC eine neue Runde starten; jeder neue Run wird serverseitig
-- der aktiven Runde zugeordnet.

create table quiz_rounds (
  round int primary key,
  started_at timestamptz not null default now(),
  ended_at timestamptz            -- null = laufende (aktive) Runde
);

-- Ausgangslage: Runde 1 ist beendet (Bestand), Runde 2 läuft.
insert into quiz_rounds (round, ended_at) values
  (1, '2026-07-06T00:00:00+02:00'),
  (2, null);

alter table quiz_rounds enable row level security;

create policy "quiz_rounds_select_public"
  on quiz_rounds for select using (true);

create policy "quiz_rounds_admin_write"
  on quiz_rounds for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Jeder neue Quiz-Run bekommt serverseitig die aktive Runde
-- (ein vom Client gesendeter round-Wert wird bewusst überschrieben).
alter table quiz_runs alter column round drop default;

create or replace function set_quiz_run_round() returns trigger
language plpgsql as $$
begin
  new.round := coalesce(
    (select round from quiz_rounds where ended_at is null order by round desc limit 1), 1);
  return new;
end; $$;

create trigger quiz_runs_set_round
  before insert on quiz_runs
  for each row execute function set_quiz_run_round();

-- Admin startet eine neue Runde: aktuelle schließen, nächste anlegen. Gibt die
-- neue Rundennummer zurück.
create or replace function start_new_quiz_round() returns int
language plpgsql security definer as $$
declare next_round int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Nur Admins dürfen eine neue Runde starten.';
  end if;
  update quiz_rounds set ended_at = now() where ended_at is null;
  select coalesce(max(round), 0) + 1 into next_round from quiz_rounds;
  insert into quiz_rounds (round) values (next_round);
  return next_round;
end; $$;
