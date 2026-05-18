import supabase from "../supabase.js";

let queue = [];
let flushTimer = null;
let coupleId = null;
let userId = null;

export function setTrackContext(ctx) {
  if (ctx.coupleId) coupleId = ctx.coupleId;
  if (ctx.userId) userId = ctx.userId;
}

export function track(name, props = {}) {
  queue.push({
    name,
    props,
    user_agent: navigator.userAgent.slice(0, 200),
    ts: new Date().toISOString(),
  });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 2000);
}

async function flush() {
  flushTimer = null;
  if (!queue.length) return;
  const batch = queue.splice(0);
  try {
    const rows = batch.map(e => ({
      couple_id: coupleId,
      user_id: userId,
      name: e.name,
      props: e.props,
      user_agent: e.user_agent,
      ts: e.ts,
    }));
    const { error } = await supabase.from("events").insert(rows);
    if (error) {
      // Table may not exist yet — silently discard
      if (error.code !== "42P01" && !error.message?.includes("does not exist")) {
        console.debug("[track] flush error:", error.message);
      }
    }
  } catch {
    // Network error — discard batch silently
  }
}

if (typeof window !== "undefined") window.__mpTrack = track;
