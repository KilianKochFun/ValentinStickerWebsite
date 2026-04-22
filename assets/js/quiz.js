// Quiz-Helpers: speichert Runs, liest Highscores und Nutzer-Statistiken.
import { supabase } from "./supabase-client.js";

// Einreichen nur für eingeloggte Nutzer. Gäste bekommen { saved: false }.
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
export async function fetchTopScores(quizType, limit = 10) {
  const { data } = await supabase
    .from("quiz_runs")
    .select("user_id, score, played_at, profiles:user_id(display_name)")
    .eq("quiz_type", quizType)
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

export async function fetchUserBest(userId, quizType) {
  const { data } = await supabase
    .from("quiz_runs")
    .select("score, played_at")
    .eq("user_id", userId)
    .eq("quiz_type", quizType)
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
