/**
 * QUN Search API — Cloudflare Worker
 *
 * Configure secret TAVILY_API_KEY with:
 *   npx wrangler secret put TAVILY_API_KEY
 *
 * Deploy from this directory with Wrangler after configuring account access.
 * This endpoint uses an external search provider for the first web-search MVP;
 * it does not claim to be QUN's own crawler/index.
 */
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const headers = { ...JSON_HEADERS, "vary": "Origin" };
  if (allowed.includes(origin)) headers["access-control-allow-origin"] = origin;
  return headers;
}

function respond(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(request, env),
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const headers = corsHeaders(request, env);
      headers["access-control-allow-methods"] = "GET, OPTIONS";
      headers["access-control-allow-headers"] = "content-type";
      headers["access-control-max-age"] = "86400";
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === "/health") {
      return respond(request, env, {
        ok: true,
        service: "QUN Search API",
        mode: "external-provider",
        provider_configured: Boolean(env.TAVILY_API_KEY),
      });
    }

    if (url.pathname !== "/api/search" || request.method !== "GET") {
      return respond(request, env, {
        error: "not_found",
        message: "Use GET /api/search?q=your+query",
      }, 404);
    }

    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2) {
      return respond(request, env, {
        error: "invalid_query",
        message: "Введите не менее двух символов.",
      }, 400);
    }
    if (q.length > 300) {
      return respond(request, env, {
        error: "query_too_long",
        message: "Запрос должен быть короче 300 символов.",
      }, 400);
    }
    if (!env.TAVILY_API_KEY) {
      return respond(request, env, {
        error: "provider_not_configured",
        message: "Веб-поиск ещё не подключён: администратору нужно настроить TAVILY_API_KEY в секретах Worker.",
      }, 503);
    }

    const requested = Number.parseInt(url.searchParams.get("limit") || "10", 10);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(requested, 10)) : 10;

    try {
      const upstream = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": "Bearer " + env.TAVILY_API_KEY,
        },
        body: JSON.stringify({
          query: q,
          topic: "general",
          search_depth: "basic",
          max_results: limit,
          include_answer: false,
          include_raw_content: false,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!upstream.ok) {
        return respond(request, env, {
          error: "search_provider_error",
          message: upstream.status === 429
            ? "Превышен лимит поисковых запросов. Попробуйте позже."
            : "Внешний поисковый провайдер временно недоступен.",
        }, upstream.status === 429 ? 429 : 502);
      }

      const payload = await upstream.json();
      const results = (Array.isArray(payload.results) ? payload.results : [])
        .map((item, index) => ({
          rank: index + 1,
          title: String(item.title || item.url || "Без названия").slice(0, 300),
          url: String(item.url || ""),
          snippet: String(item.content || "").slice(0, 1200),
          score: typeof item.score === "number" ? item.score : null,
          source: "Tavily",
          published_at: item.published_date || null,
        }))
        .filter((item) => {
          try {
            const parsed = new URL(item.url);
            return parsed.protocol === "https:" || parsed.protocol === "http:";
          } catch {
            return false;
          }
        });

      return respond(request, env, {
        ok: true,
        query: q,
        provider: "Tavily",
        mode: "external-provider",
        results,
        result_count: results.length,
        notice: "Результаты получены через внешний поисковый индекс. Собственный индекс QUN находится в разработке.",
      });
    } catch {
      return respond(request, env, {
        error: "search_timeout",
        message: "Не удалось выполнить поиск. Попробуйте ещё раз.",
      }, 504);
    }
  },
};
