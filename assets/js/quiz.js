// Quiz-Helpers: speichert Runs, liest Highscores und Nutzer-Statistiken.
import { supabase } from "./supabase-client.js";

// Die aktive Quiz-Runde liegt in der DB (Tabelle quiz_rounds). Hier gecacht,
// damit nicht jede Anzeige neu nachfragt.
let _currentRound = null;
export async function getCurrentRound() {
  if (_currentRound != null) return _currentRound;
  const { data } = await supabase
    .from("quiz_rounds")
    .select("round")
    .is("ended_at", null)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();
  _currentRound = data?.round ?? 1;
  return _currentRound;
}

// Alle Runden für die Archiv-Anzeige (neueste zuerst).
export async function fetchRounds() {
  const { data } = await supabase
    .from("quiz_rounds")
    .select("round, started_at, ended_at")
    .order("round", { ascending: false });
  return data ?? [];
}

// Einreichen nur für eingeloggte Nutzer. Die Runde stempelt die DB serverseitig
// (Trigger), daher wird hier bewusst kein round mitgeschickt.
export async function submitQuizRun(quizType, score) {
  if (!Number.isInteger(score) || score < 0) return { saved: false, reason: "invalid" };
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return { saved: false, reason: "guest" };
  const { error } = await supabase.from("quiz_runs").insert({
    user_id: user.id, quiz_type: quizType, score,
  });
  if (error) return { saved: false, reason: error.message };
  return { saved: true };
}

// Top N Nutzer für einen Quiz-Typ nach persönlicher Bestleistung.
// Wir holen die besten ~200 Runs und reduzieren clientseitig auf max per user_id.
// Bei steigendem Volumen würde eine DB-View mit DISTINCT ON Sinn ergeben.
export async function fetchTopScores(quizType, limit = 10, round = null) {
  const r = round ?? await getCurrentRound();
  const { data } = await supabase
    .from("quiz_runs")
    .select("user_id, score, played_at, profiles:user_id(display_name)")
    .eq("quiz_type", quizType)
    .eq("round", r)
    .order("score", { ascending: false })
    .limit(200);
  if (!data) return [];
  const best = new Map();
  for (const r of data) {
    const prev = best.get(r.user_id);
    if (!prev || r.score > prev.score) best.set(r.user_id, r);
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || new Date(a.played_at) - new Date(b.played_at))
    .slice(0, limit)
    .map((r) => ({
      user_id: r.user_id,
      display_name: r.profiles?.display_name ?? "Unbekannt",
      score: r.score,
      played_at: r.played_at,
    }));
}

export async function fetchUserBest(userId, quizType, round = null) {
  const r = round ?? await getCurrentRound();
  const { data } = await supabase
    .from("quiz_runs")
    .select("score, played_at")
    .eq("user_id", userId)
    .eq("quiz_type", quizType)
    .eq("round", r)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function fetchUserRuns(userId) {
  const { data } = await supabase
    .from("quiz_runs")
    .select("quiz_type, score, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false });
  return data ?? [];
}
