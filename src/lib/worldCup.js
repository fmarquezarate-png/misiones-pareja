// World Cup 2026 – fetch, parse, cache
// Source: openfootball/worldcup.json (GitHub raw, no API key needed, CORS-friendly)
// Times are displayed as-is from the source with "(h. local)" label —
// venues span ET/CT/MT/PT so per-match conversion would need venue data.

const CACHE_KEY = "mp-wc2026";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const SOURCES = [
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
  "https://raw.githubusercontent.com/openfootball/worldcup.json/main/2026/worldcup.json",
];

// Argentina is UTC-3, no DST in June/July.
// Convert a UTC timeStr ("19:00") + ISO dateStr ("2026-06-11") → { date, time } in Argentina.
export function toArgentineTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };
  try {
    const utcMs = new Date(dateStr + "T" + timeStr + ":00Z").getTime();
    if (isNaN(utcMs)) return { date: dateStr, time: timeStr };
    const arMs = utcMs - 3 * 60 * 60 * 1000;
    const d = new Date(arMs);
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

// Build flag emoji from ISO country code (e.g. "MX" → 🇲🇽)
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
  let timesAreUTC = !!data.utc; // some sources mark UTC explicitly
  for (const r of rounds) {
    const roundName = r.name || "";
    for (const m of (r.matches || [])) {
      const date = parseDate(m.date);
      if (!date) continue;
      const team1 = teamStr(m.team1);
      const team2 = teamStr(m.team2);
      const t1code = typeof m.team1 === "object" ? m.team1.code : null;
      const t2code = typeof m.team2 === "object" ? m.team2.code : null;
      let matchDate = date;
      let matchTime = m.time || null;
      if (timesAreUTC && matchTime) {
        const ar = toArgentineTime(date, matchTime);
        matchDate = ar.date;
        matchTime = ar.time;
      }
      out.push({
        id: `wc26-${m.num ?? autoNum++}`,
        date: matchDate,
        time: matchTime,
        timesAreUTC,
        home: team1,
        away: team2,
        homeFlag: t1code ? flagEmoji(t1code) : "",
        awayFlag: t2code ? flagEmoji(t2code) : "",
        round: roundName,
        score1: m.score1 ?? null,
        score2: m.score2 ?? null,
        group: r.group || null,
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
