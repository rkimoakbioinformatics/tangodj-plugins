// Keep the storage address stable; the record carries its schema version.
export const SETTINGS_KEY = "orchestra-reminder.settings.v1";
export const HISTORY_KEY = "orchestra-reminder.history.v1";

export function orchestraKey(name) {
    return name.trim().normalize("NFC").toLocaleLowerCase("en");
}

export function validateSettings(value) {
    if (value?.version !== 2 || !Array.isArray(value.rules)) throw new Error("Invalid orchestra reminder settings.");
    const names = new Set();
    const rules = value.rules.map(({ orchestra, minutes }) => {
        if (typeof orchestra !== "string" || !orchestra.trim()) throw new Error("Enter an orchestra name for every card.");
        if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("Thresholds must be greater than zero minutes.");
        const key = orchestraKey(orchestra);
        if (names.has(key)) throw new Error("Each orchestra can have only one card.");
        names.add(key);
        return { orchestra: orchestra.trim(), minutes };
    });
    return { version: 2, rules };
}

export function migrateSettings(value) {
    if (value?.version === 1) {
        if (typeof value.expanded !== "boolean") throw new Error("Invalid orchestra reminder settings.");
        value = { version: 2, rules: value.rules };
    }
    return validateSettings(value);
}

export function playlistActive(playback) {
    return ["playing", "paused"].includes(playback.status) && playback.source?.pane_name === "Playlist" && playback.currentTrack?.entryRef != null;
}

function playbackIdentity(playback) {
    return playlistActive(playback) ? `${playback.source.node_uid}:${playback.currentTrack.entryRef}` : null;
}

export async function readSnapshot(api) {
    const first = await api.get("playback", { player: "main" });
    if (!playlistActive(first)) return { playback: first, groups: [], playlist: null };
    const id = String(first.source.node_uid);
    const [groups, lists] = await Promise.all([
        api.get("playlist", { id, group: true }),
        api.get("lists", { panel: "Playlist", id }),
    ]);
    const playback = await api.get("playback", { player: "main" });
    if (playbackIdentity(first) !== playbackIdentity(playback)) return null;
    if (lists.length !== 1) throw new Error("The playing playlist is no longer available.");
    return { playback, groups, playlist: lists[0] };
}

function names(tracks, field) {
    const values = new Map();
    for (const track of tracks) {
        const name = track[field].trim();
        if (name) values.set(orchestraKey(name), name);
    }
    return [...values.values()];
}

export function emptyHistory() {
    return { version: 1, playlistId: null, playlistName: "", activeTandaRef: null, entries: [] };
}

export function validateHistory(value) {
    const validRef = (ref) => typeof ref === "string" && /^\d+$/.test(ref);
    const validNames = (values) => Array.isArray(values) && values.every((name) => typeof name === "string");
    if (value?.version !== 1 || (value.playlistId !== null && !validRef(value.playlistId)) || typeof value.playlistName !== "string" || (value.activeTandaRef !== null && !validRef(value.activeTandaRef)) || !Array.isArray(value.entries)) throw new Error("Invalid saved tanda history.");
    if (value.entries.some((entry) => !entry || !validRef(entry.entryRef) || !Number.isFinite(entry.playedAt) || entry.playedAt < 0 || !Number.isFinite(new Date(entry.playedAt).getTime()) || !validNames(entry.orchestras) || !validNames(entry.singers))) throw new Error("Invalid saved tanda history entry.");
    if ((value.playlistId === null && value.entries.length) || (value.activeTandaRef !== null && value.entries.at(-1)?.entryRef !== value.activeTandaRef)) throw new Error("Invalid saved tanda history state.");
    return value;
}

export function observePlayback(history, { playback, groups, playlist }, observedAt) {
    if (!Number.isFinite(observedAt) || observedAt < 0) throw new Error("Invalid tanda observation time.");
    if (!playlistActive(playback)) return history.activeTandaRef === null ? history : { ...history, activeTandaRef: null };
    const group = groups.find((tracks) => tracks.some((track) => track.entryRef === playback.currentTrack.entryRef));
    if (!group) throw new Error("The playing track is no longer in this playlist. Waiting for playback to update.");
    const playlistId = String(playback.source.node_uid);
    let next = history.playlistId === playlistId ? history : { ...emptyHistory(), playlistId, playlistName: playlist.name };
    if (next.playlistName !== playlist.name) next = { ...next, playlistName: playlist.name };
    const music = group.filter((track) => !track.isCortina);
    const tandaRef = music.length ? group[0].entryRef : null;
    if (tandaRef === null || (playback.status === "paused" && next.activeTandaRef !== tandaRef)) return next.activeTandaRef === null ? next : { ...next, activeTandaRef: null };
    if (playback.status !== "playing" || next.activeTandaRef === tandaRef) return next;
    const entry = { entryRef: tandaRef, playedAt: observedAt, orchestras: names(music, "orchestra"), singers: names(music, "singer") };
    return { ...next, activeTandaRef: tandaRef, entries: [...next.entries, entry] };
}

export function rotationRows(rules, history, now) {
    const latest = new Map();
    for (const tanda of history.entries) {
        for (const orchestra of tanda.orchestras) latest.set(orchestraKey(orchestra), tanda.playedAt);
    }
    return rules.map((rule, index) => {
        const key = orchestraKey(rule.orchestra);
        let start;
        for (const [orchestra, playedAt] of latest) {
            if (key && orchestra.includes(key) && (start === undefined || playedAt > start)) start = playedAt;
        }
        const elapsedSeconds = start === undefined ? null : Math.max(0, (now - start) / 1000);
        const due = elapsedSeconds === null || elapsedSeconds >= rule.minutes * 60;
        return { ...rule, index, elapsedSeconds, due };
    }).sort((a, b) => Number(b.due) - Number(a.due) || a.index - b.index);
}

export function lastPlayed(seconds) {
    return seconds === null ? "Not played" : `${Math.floor(seconds / 60)} min ago`;
}
