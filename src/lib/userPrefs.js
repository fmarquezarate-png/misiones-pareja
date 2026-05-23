export const getUserPrefs = id => { try { return JSON.parse(localStorage.getItem(`user-prefs-${id}`)||"{}"); } catch { return {}; } };
export const saveUserPrefs = (id, patch) => { try { localStorage.setItem(`user-prefs-${id}`, JSON.stringify({...getUserPrefs(id),...patch})); } catch {} };
