import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
if (!SERVICE_KEY) throw new Error("Missing server key");
const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, authorization, x-client-info, x-supabase-api-version",
  "Vary": "Origin"
};
const out = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
});
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(v => v.toString(16).padStart(2, "0")).join("");
const randomHex = (bytes: number) => Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map(v => v.toString(16).padStart(2, "0")).join("");

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return out({ error: "POST required" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return out({ error: "Войдите через QUN ID." }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return out({ error: "Сессия истекла. Войдите снова." }, 401);
  const userId = auth.user.id;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return out({ error: "Некорректный JSON." }, 400); }
  const action = String(body.action || "");
  try {
    if (action === "consent") {
      if (body.enabled !== true && body.enabled !== false) return out({ error: "enabled должен быть true или false." }, 400);
      const enabled = body.enabled === true;
      const { error } = await db.from("qun_browser_preferences").upsert({
        user_id: userId, enabled, consent_version: "browser-compute-v1",
        consented_at: enabled ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (error) return out({ error: "Не удалось сохранить настройки участия." }, 500);
      return out({ ok: true, enabled, consentVersion: "browser-compute-v1" });
    }
    if (action === "status") {
      const [{ data: pref }, { count, error: countError }, { data: recent, error: recentError }] = await Promise.all([
        db.from("qun_browser_preferences").select("enabled,consent_version,consented_at,updated_at").eq("user_id", userId).maybeSingle(),
        db.from("qun_browser_contributions").select("contribution_id", { count: "exact", head: true }).eq("user_id", userId),
        db.from("qun_browser_contributions").select("credits,created_at,proof_hash").eq("user_id", userId).order("created_at", { ascending: false }).limit(10)
      ]);
      if (countError || recentError) return out({ error: "Не удалось загрузить статистику." }, 500);
      const totalCredits = (recent || []).reduce((sum, row) => sum + Number(row.credits || 0), 0);
      const { data: all } = await db.from("qun_browser_contributions").select("credits").eq("user_id", userId);
      return out({ enabled: pref?.enabled === true, consentVersion: pref?.consent_version || null, contributionCount: count || 0, totalCredits: (all || []).reduce((sum, row) => sum + Number(row.credits || 0), 0), recent: (recent || []).map(row => ({ credits: row.credits, createdAt: row.created_at, proofHash: row.proof_hash })) });
    }
    if (action === "issue_challenge") {
      const { data: pref } = await db.from("qun_browser_preferences").select("enabled").eq("user_id", userId).maybeSingle();
      if (!pref?.enabled) return out({ error: "Сначала включите добровольное участие в вычислениях." }, 403);
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count } = await db.from("qun_browser_challenges").select("challenge_id", { count: "exact", head: true }).eq("user_id", userId).gt("created_at", since);
      if ((count || 0) >= 12) return out({ error: "Лимит тестовых задач на минуту достигнут. Попробуйте чуть позже." }, 429);
      const challenge = randomHex(24);
      const difficulty = 4;
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
      const { data, error } = await db.from("qun_browser_challenges").insert({ user_id: userId, challenge, difficulty, expires_at: expiresAt }).select("challenge_id,challenge,difficulty,expires_at").single();
      if (error || !data) return out({ error: "Не удалось выдать вычислительную задачу." }, 500);
      return out({ challengeId: data.challenge_id, challenge: data.challenge, difficulty: data.difficulty, expiresAt: data.expires_at });
    }
    if (action === "submit_proof") {
      const { data: currentPref } = await db.from("qun_browser_preferences").select("enabled").eq("user_id", userId).maybeSingle();
      if (!currentPref?.enabled) return out({ error: "Участие в вычислениях выключено. Доказательство не будет принято." }, 403);
      const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
      const nonce = Number(body.nonce);
      const proofHash = typeof body.proofHash === "string" ? body.proofHash.toLowerCase() : "";
      if (!challengeId || !Number.isSafeInteger(nonce) || nonce < 0 || nonce > 2_000_000 || !/^[a-f0-9]{64}$/.test(proofHash)) return out({ error: "Доказательство имеет неверный формат." }, 400);
      const { data: challenge, error } = await db.from("qun_browser_challenges").select("challenge_id,challenge,difficulty,expires_at,used_at").eq("challenge_id", challengeId).eq("user_id", userId).maybeSingle();
      if (error || !challenge) return out({ error: "Задача не найдена." }, 404);
      if (challenge.used_at) return out({ error: "Эта задача уже зачтена." }, 409);
      if (new Date(challenge.expires_at).getTime() < Date.now()) return out({ error: "Время задачи истекло. Запросите новую." }, 410);
      const expected = await sha256(challenge.challenge + ":" + String(nonce));
      if (expected !== proofHash || !proofHash.startsWith("0".repeat(Number(challenge.difficulty)))) return out({ error: "Проверка вычисления не пройдена." }, 422);
      const { data: consumed, error: consumeError } = await db.from("qun_browser_challenges").update({ used_at: new Date().toISOString() }).eq("challenge_id", challengeId).eq("user_id", userId).is("used_at", null).gt("expires_at", new Date().toISOString()).select("challenge_id").maybeSingle();
      if (consumeError || !consumed) return out({ error: "Задача уже использована или истекла." }, 409);
      const { data: contribution, error: insertError } = await db.from("qun_browser_contributions").insert({ user_id: userId, challenge_id: challengeId, proof_hash: proofHash, nonce, credits: 1 }).select("contribution_id,credits,created_at").single();
      if (insertError || !contribution) return out({ error: "Доказательство принято, но запись вклада не сохранилась. Обратитесь в поддержку." }, 500);
      const { count } = await db.from("qun_browser_contributions").select("contribution_id", { count: "exact", head: true }).eq("user_id", userId);
      return out({ ok: true, contribution: { credits: contribution.credits, createdAt: contribution.created_at, proofHash }, contributionCount: count || 0, rewardType: "QUN Compute Credits (тестовые, не криптовалюта)" }, 201);
    }
    return out({ error: "Неизвестное действие." }, 400);
  } catch (error) {
    console.error("qun-browser-compute error", error instanceof Error ? error.message : "unknown");
    return out({ error: "Ошибка обработки вычислительного запроса." }, 500);
  }
});