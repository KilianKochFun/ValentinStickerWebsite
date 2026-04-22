-- Quiz-Runs: globale Highscore-Tabelle über alle Quiz-Varianten.
-- Ein Insert pro beendeter Runde. Gäste dürfen spielen, aber nicht speichern:
-- user_id ist NOT NULL und RLS erlaubt Insert nur, wenn user_id = auth.uid().
--
-- Anzeige „Top-Liste" zieht clientseitig pro user_id den max(score).

create type quiz_type as enum ('location', 'description', 'title');

create table quiz_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  quiz_type quiz_type not null,
  score int not null check (score >= 0),
  played_at timestamptz not null default now()
);

create index quiz_runs_type_score_idx on quiz_runs (quiz_type, score desc);
create index quiz_runs_user_idx on quiz_runs (user_id, played_at desc);

alter table quiz_runs enable row level security;

create policy "quiz_runs_select_public"
  on quiz_runs for select
  using (true);

create policy "quiz_runs_insert_self"
  on quiz_runs for insert
  with check (user_id = auth.uid());

create policy "quiz_runs_delete_self_or_admin"
  on quiz_runs for delete
  using (user_id = auth.uid() or is_admin(auth.uid()));
