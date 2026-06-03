// World Cup 2026 – fetch, parse, cache
// Source: openfootball/worldcup.json (GitHub raw, no API key, CORS-friendly)
// Times in openfootball JSON are UTC. We convert to Spain/Barcelona (CEST = UTC+2) for June/July.

const CACHE_KEY = "mp-wc2026v2"; // v2: times converted to Spain time
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const SOURCES = [
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
  "https://raw.githubusercontent.com/openfootball/worldcup.json/main/2026/worldcup.json",
];

// Spain/Barcelona in June-July = CEST = UTC+2.
// openfootball times are UTC, so add 2 hours.
export function toSpainTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };
  try {
    const utcMs = new Date(dateStr + "T" + timeStr + ":00Z").getTime();
    if (isNaN(utcMs)) return { date: dateStr, time: timeStr };
    const spMs = utcMs + 2 * 60 * 60 * 1000; // UTC+2 (CEST)
    const d = new Date(spMs);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dy = String(d.getUTCDate()).padStart(2, "0");
    const h = String(d.getUTCHours()).padStart(2, "0");
    const m = String(d.getUTCMinutes()).padStart(2, "0");
    return { date: `${y}-${mo}-${dy}`, time: `${h}:${m}` };
  } catch {
    return { date: dateStr, time: timeStr };
  }
}

// Parse "Jun/11" → "2026-06-11"; ISO dates pass through.
function parseDate(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const MONS = { Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12" };
  const [mon, day] = String(raw).split("/");
  const mo = MONS[mon];
  if (!mo) return null;
  return `2026-${mo}-${String(parseInt(day, 10)).padStart(2, "0")}`;
}

// Team name from string or { name, code } object
function teamStr(t) {
  if (!t) return "TBD";
  if (typeof t === "string") return t.trim() || "TBD";
  return (t.name || t.code || "TBD").trim();
}

// Build flag emoji from 2-letter ISO country code (e.g. "MX" → 🇲🇽)
function flagEmoji(code) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

function parseRounds(data) {
  const rounds = data.rounds || data.groups || [];
  const out = [];
  let autoNum = 1;
  for (const r of rounds) {
    const roundName = r.name || "";
    for (const m of (r.matches || [])) {
      const rawDate = parseDate(m.date);
      if (!rawDate) continue;
      const team1 = teamStr(m.team1);
      const team2 = teamStr(m.team2);
      const t1code = typeof m.team1 === "object" ? m.team1.code : null;
      const t2code = typeof m.team2 === "object" ? m.team2.code : null;
      // openfootball times are UTC → convert to Spain/Barcelona (CEST, UTC+2)
      const rawTime = m.time || null;
      const { date: matchDate, time: matchTime } = rawTime
        ? toSpainTime(rawDate, rawTime)
        : { date: rawDate, time: null };
      out.push({
        id: `wc26-${m.num ?? autoNum++}`,
        date: matchDate,
        time: matchTime,
        home: team1,
        away: team2,
        homeFlag: t1code ? flagEmoji(t1code) : "",
        awayFlag: t2code ? flagEmoji(t2code) : "",
        round: roundName,
        score1: m.score1 ?? null,
        score2: m.score2 ?? null,
      });
    }
  }
  return out;
}

export async function fetchWCMatches() {
  // Serve from cache if fresh
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c?.ts && Date.now() - c.ts < TTL_MS && Array.isArray(c.matches) && c.matches.length > 0) {
      return c.matches;
    }
  } catch {}

  // Try each source
  for (const url of SOURCES) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) continue;
      const data = await res.json();
      const matches = parseRounds(data);
      if (matches.length > 0) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), matches }));
        } catch {}
        return matches;
      }
    } catch {}
  }

  // Stale cache is better than nothing
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (Array.isArray(c?.matches) && c.matches.length > 0) return c.matches;
  } catch {}

  return null;
}

export function wcMatchesForDate(matches, dateStr) {
  if (!matches || !dateStr) return [];
  return matches.filter(m => m.date === dateStr);
}

export function wcMatchesForMonth(matches, year, month) {
  if (!matches) return [];
  const pfx = `${year}-${String(month + 1).padStart(2, "0")}`;
  return matches.filter(m => m.date?.startsWith(pfx));
}

// True if year/month overlaps with WC 2026 (June 11 – July 19)
export function isWCMonth(year, month) {
  return year === 2026 && (month === 5 || month === 6); // June=5, July=6
}

// True after the Final (July 19 2026) — mode auto-disables
export function isWCOver() {
  return new Date() > new Date("2026-07-19T23:59:59Z");
}
