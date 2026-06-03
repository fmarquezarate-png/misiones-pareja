// World Cup 2026 – fetch, parse, cache
// Source: openfootball/worldcup.json
// Data structure: { name, matches: [{ round, date, time:"HH:MM UTC±N", team1, team2, group, ground }] }
// Times are in LOCAL venue time with UTC offset embedded — we convert to Spain/Barcelona (CEST = UTC+2).

const CACHE_KEY = "mp-wc2026v3"; // v3: correct parser + Spain timezone
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const SOURCES = [
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
  "https://raw.githubusercontent.com/openfootball/worldcup.json/main/2026/worldcup.json",
];

// Parse "HH:MM UTC±N" → Spain CEST (UTC+2).
// e.g. "13:00 UTC-6" → 13 - (-6) + 2 = 21:00 Spain
//      "20:00 UTC-6" → 20 + 6 + 2 = 28h → 04:00 next day
function toSpainTime(dateStr, rawTime) {
  if (!dateStr || !rawTime) return { date: dateStr, time: null };
  const m = rawTime.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d+)$/i);
  if (!m) return { date: dateStr, time: rawTime.slice(0, 5) || null };
  const localH = parseInt(m[1], 10);
  const localMn = parseInt(m[2], 10);
  const offset = parseInt(m[3], 10); // e.g. -6, -4, -5, -7
  // local → UTC → Spain (UTC+2)
  const spainMin = (localH - offset + 2) * 60 + localMn;
  const dayMin = 24 * 60;
  const norm = ((spainMin % dayMin) + dayMin) % dayMin;
  const spH = Math.floor(norm / 60);
  const spMn = norm % 60;
  let date = dateStr;
  if (spainMin < 0) {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    date = d.toISOString().slice(0, 10);
  } else if (spainMin >= dayMin) {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    date = d.toISOString().slice(0, 10);
  }
  return { date, time: `${String(spH).padStart(2, "0")}:${String(spMn).padStart(2, "0")}` };
}

function teamStr(t) {
  if (!t) return "TBD";
  if (typeof t === "string") return t.trim() || "TBD";
  return (t.name || t.code || "TBD").trim();
}

// Attempt to build a flag emoji for known country names
const FLAG_MAP = {
  "Mexico":"🇲🇽","South Africa":"🇿🇦","South Korea":"🇰🇷","Czech Republic":"🇨🇿",
  "USA":"🇺🇸","United States":"🇺🇸","Canada":"🇨🇦","Argentina":"🇦🇷","Brazil":"🇧🇷",
  "Germany":"🇩🇪","France":"🇫🇷","Spain":"🇪🇸","England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Portugal":"🇵🇹",
  "Netherlands":"🇳🇱","Belgium":"🇧🇪","Japan":"🇯🇵","Australia":"🇦🇺","Morocco":"🇲🇦",
  "Senegal":"🇸🇳","Uruguay":"🇺🇾","Colombia":"🇨🇴","Ecuador":"🇪🇨","Chile":"🇨🇱",
  "Peru":"🇵🇪","Venezuela":"🇻🇪","Bolivia":"🇧🇴","Paraguay":"🇵🇾","Panama":"🇵🇦",
  "Costa Rica":"🇨🇷","Jamaica":"🇯🇲","Honduras":"🇭🇳","El Salvador":"🇸🇻","Guatemala":"🇬🇹",
  "Nigeria":"🇳🇬","Ghana":"🇬🇭","Ivory Coast":"🇨🇮","Cameroon":"🇨🇲","Egypt":"🇪🇬",
  "Tunisia":"🇹🇳","Algeria":"🇩🇿","Mali":"🇲🇱","DR Congo":"🇨🇩","Guinea":"🇬🇳",
  "Saudi Arabia":"🇸🇦","Iran":"🇮🇷","Indonesia":"🇮🇩","Qatar":"🇶🇦","UAE":"🇦🇪",
  "Uzbekistan":"🇺🇿","Kyrgyzstan":"🇰🇬","Switzerland":"🇨🇭","Italy":"🇮🇹",
  "Croatia":"🇭🇷","Poland":"🇵🇱","Serbia":"🇷🇸","Hungary":"🇭🇺","Slovakia":"🇸🇰",
  "Ukraine":"🇺🇦","Austria":"🇦🇹","Denmark":"🇩🇰","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","Wales":"🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Albania":"🇦🇱","Georgia":"🇬🇪","Slovenia":"🇸🇮","Romania":"🇷🇴","Turkey":"🇹🇷","Greece":"🇬🇷",
  "New Zealand":"🇳🇿",
};

function parseMatches(data) {
  const raw = data.matches || data.rounds || [];
  const out = [];
  let autoNum = 1;
  // Handle both flat array and nested rounds structure
  const flatMatches = Array.isArray(raw)
    ? raw.flatMap(item => item.matches ? item.matches.map(m => ({ ...m, _round: item.name })) : [item])
    : [];
  for (const m of flatMatches) {
    const date = m.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const team1 = teamStr(m.team1);
    const team2 = teamStr(m.team2);
    const { date: matchDate, time: matchTime } = toSpainTime(date, m.time || null);
    out.push({
      id: `wc26-${m.num ?? autoNum++}`,
      date: matchDate,
      time: matchTime,
      home: team1,
      away: team2,
      homeFlag: FLAG_MAP[team1] || "",
      awayFlag: FLAG_MAP[team2] || "",
      round: m.round || m._round || m.group || "",
      score1: m.score1 ?? null,
      score2: m.score2 ?? null,
    });
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
      const matches = parseMatches(data);
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

// True if year/month overlaps with WC 2026 (June–July)
export function isWCMonth(year, month) {
  return year === 2026 && (month === 5 || month === 6);
}

// True after the Final (July 19 2026) — mode auto-disables
export function isWCOver() {
  return new Date() > new Date("2026-07-19T23:59:59Z");
}
