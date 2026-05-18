import { NextResponse } from "next/server";

const SESSION_COOKIE = process.env.LOGGED_TG_SESSION_COOKIE!;
const SESSION_URL    = "https://logged.tg/api/session";
const API_BASE       = "https://api.injuries.to";
const SECRET         = process.env.STATS_API_SECRET;

async function getAuthTokens() {
  const res = await fetch(SESSION_URL, {
    headers: {
      Cookie:       SESSION_COOKIE,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      Referer:      "https://logged.tg/dashboard",
      Accept:       "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Session fetch failed (${res.status}) — cookie may be expired.`);

  const data = await res.json();
  const authArr = data?.Auth ?? data?.userSettings?.Auth ?? null;
  if (!authArr) throw new Error("Auth tokens not found in session response.");

  const id    = Array.isArray(authArr) ? String(authArr[0]) : String(authArr.Id    ?? authArr.id    ?? "");
  const token = Array.isArray(authArr) ? String(authArr[1]) : String(authArr.Token ?? authArr.token ?? "");

  if (!id || !token) throw new Error("id or token missing from session Auth field.");

  return { id, token, raw: data as Record<string, unknown> };
}

export async function GET(request: Request) {
  if (SECRET) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!SESSION_COOKIE) {
    return NextResponse.json({ ok: false, error: "LOGGED_TG_SESSION_COOKIE is not configured." }, { status: 500 });
  }

  try {
    const { id, token, raw: sessionData } = await getAuthTokens();

    const res = await fetch(`${API_BASE}/api/auth`, {
      headers: {
        "x-id":         id,
        "x-token":      token,
        "content-type": "application/json; charset=utf-8",
        "User-Agent":   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Origin:         "https://logged.tg",
        Referer:        "https://logged.tg/dashboard",
        Accept:         "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Stats API returned ${res.status}.`);

    const data = await res.json() as Record<string, unknown>;

    const mainData = (data?.omniData as Record<string, unknown>)?.Main as Record<string, unknown>
                     ?? (data?.Main as Record<string, unknown>)
                     ?? data;
    const inner      = (mainData?.Data as Record<string, unknown>) ?? mainData;
    const totals     = (inner?.Totals as Record<string, number>) ?? {};
    const limiteds   = ((inner?.Collectibles as Record<string, unknown>)?.Limiteds as Record<string, number>) ?? {};
    const userSettings = (sessionData?.userSettings ?? sessionData?.user ?? {}) as Record<string, unknown>;

    const stats = {
      userName:    String(userSettings?.userName    ?? "Unknown"),
      displayName: String(userSettings?.displayName ?? userSettings?.userName ?? "Unknown"),
      hits:        Number(totals?.Accounts ?? 0),
      summary:     Number(totals?.Summary  ?? 0),
      balance:     Number(totals?.Balance  ?? 0),
      rap:         Number(totals?.Rap      ?? 0),
      rapItems:    Number(limiteds?.Rap    ?? 0),
    };

    return NextResponse.json({ ok: true, stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
