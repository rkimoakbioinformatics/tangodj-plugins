import { SETTINGS_KEY, HISTORY_KEY, validateSettings, migrateSettings, emptyHistory, validateHistory, readSnapshot, observePlayback, rotationRows, lastPlayed } from "./model.js";
const byId = (id) => document.getElementById(id);
const api = window.tangodj;
const inputClass = "rot:box-border rot:w-full rot:min-w-0 rot:rounded-lg rot:border rot:border-solid rot:border-stone-300 rot:bg-white rot:p-2 rot:font-sans rot:text-sm rot:text-stone-900 rot:dark:border-zinc-600 rot:dark:bg-zinc-950 rot:dark:text-zinc-100";
let settings = { version: 2, rules: [] };
let current = null;
let history = emptyHistory();
let historyDirty = false;
let timer;
let disposed = false;
let cardId = 0;
let historySignature = "";
const reported = new Set();

function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

async function reportError(error, target = "error") {
    const message = error?.message ?? String(error);
    byId(target).textContent = message;
    byId(target).hidden = false;
    if (reported.has(message)) return;
    reported.add(message);
    try { await api.reportError(`Orchestra Reminder: ${message}`); }
    catch (failure) {
        byId(target).textContent = `${message} Error reporting also failed: ${failure?.message ?? String(failure)}`;
        console.error("Orchestra Reminder error reporting failed", failure);
    }
}

function save(next) {
    const validated = validateSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(validated));
    settings = validated;
}

function markUnsaved() {
    byId("save-status").textContent = "Unsaved changes";
}

function addCard(rule = { orchestra: "", minutes: 60 }) {
    const id = ++cardId;
    const card = node("div", "rot:group rot:relative rot:flex rot:min-w-0 rot:flex-col rot:gap-3 rot:rounded-lg rot:border rot:border-solid rot:border-stone-200 rot:p-3 rot:dark:border-zinc-700");
    const label = node("label", "rot:block rot:space-y-1");
    label.htmlFor = `orchestra-${id}`;
    label.append(node("span", "rot:flex rot:min-h-8 rot:items-center rot:pr-8 rot:text-xs rot:font-medium", "Orchestra"));
    const orchestra = node("input", inputClass);
    orchestra.id = label.htmlFor;
    orchestra.name = "orchestra";
    orchestra.type = "text";
    orchestra.required = true;
    orchestra.placeholder = "D'Arienzo";
    orchestra.value = rule.orchestra;
    label.append(orchestra);
    const thresholdLabel = node("label", "rot:block rot:space-y-1");
    thresholdLabel.htmlFor = `minutes-${id}`;
    thresholdLabel.append(node("span", "rot:text-xs rot:font-medium", "Should be played at least once in... (minutes)"));
    const threshold = node("input", inputClass);
    threshold.id = thresholdLabel.htmlFor;
    threshold.name = "minutes";
    threshold.type = "number";
    threshold.min = "0.1";
    threshold.step = "any";
    threshold.required = true;
    threshold.value = String(rule.minutes);
    thresholdLabel.append(threshold);
    const remove = node("button", "rot:pointer-events-none rot:absolute rot:top-2 rot:right-2 rot:flex rot:h-8 rot:w-8 rot:cursor-pointer rot:items-center rot:justify-center rot:rounded-md rot:border-0 rot:bg-transparent rot:p-0 rot:text-zinc-500 rot:opacity-0 rot:transition-[color,background-color,opacity] rot:group-hover:pointer-events-auto rot:group-hover:opacity-100 rot:group-focus-within:pointer-events-auto rot:group-focus-within:opacity-100 rot:hover:bg-zinc-200 rot:hover:text-zinc-700 rot:focus-visible:outline-2 rot:focus-visible:outline-offset-2 rot:focus-visible:outline-zinc-500 rot:dark:text-zinc-400 rot:dark:hover:bg-zinc-800 rot:dark:hover:text-zinc-200");
    remove.type = "button";
    remove.title = "Remove orchestra";
    remove.setAttribute("aria-label", "Remove orchestra");
    remove.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/></svg>';
    remove.addEventListener("click", () => { card.remove(); markUnsaved(); });
    card.append(label, thresholdLabel, remove);
    byId("cards").append(card);
    return orchestra;
}

function renderRows() {
    byId("table-container").hidden = !current || settings.rules.length === 0;
    byId("rotation-empty").hidden = current !== null && settings.rules.length > 0;
    byId("rotation-empty").textContent = current ? "Add orchestras below." : "Waiting for current playback information.";
    byId("due-count").textContent = "";
    if (!current) return;
    const rows = rotationRows(settings.rules, history, Date.now());
    byId("due-count").textContent = rows.length ? `${rows.filter((row) => row.due).length} due` : "";
    byId("rows").replaceChildren(...rows.map((row) => {
        const tr = node("tr", "rot:border-0 rot:border-t rot:border-solid rot:border-stone-200 rot:dark:border-zinc-700");
        const elapsed = lastPlayed(row.elapsedSeconds);
        const reminder = node("td", "rot:p-3");
        reminder.append(node("span", row.due ? "rot:font-semibold rot:text-amber-700 rot:dark:text-amber-300" : "", row.due ? "Due" : "Recently played"));
        tr.append(node("th", "rot:p-3 rot:font-medium", row.orchestra), node("td", "rot:whitespace-nowrap rot:p-3 rot:font-mono rot:tabular-nums", elapsed), node("td", "rot:whitespace-nowrap rot:p-3", `${row.minutes} min`), reminder);
        tr.firstChild.scope = "row";
        return tr;
    }));
}

function render(snapshot) {
    const next = observePlayback(history, snapshot, Date.now());
    const newTanda = next.entries.length > 0 && next.entries.at(-1) !== history.entries.at(-1);
    if (next !== history) { history = next; historyDirty = true; }
    current = snapshot;
    byId("playlist").textContent = snapshot.playlist ? `${snapshot.playlist.name} · ${snapshot.playback.status === "paused" ? "Paused" : "Playing"}` : history.playlistName ? `${history.playlistName} · Playback stopped` : "No playlist is playing.";
    renderHistory(newTanda);
    renderRows();
    if (historyDirty) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        historyDirty = false;
    }
}

function renderHistory(followNewTanda = false) {
    byId("history-empty").hidden = history.entries.length > 0;
    byId("history-empty").textContent = "No tanda has been played yet.";
    byId("history-count").textContent = `${history.entries.length} tandas`;
    const activeTandaRef = current ? history.activeTandaRef : null;
    const signature = JSON.stringify([history.entries, activeTandaRef]);
    if (signature !== historySignature) {
        historySignature = signature;
        byId("history").replaceChildren(...history.entries.map((tanda, index) => {
            const active = index === history.entries.length - 1 && tanda.entryRef === activeTandaRef;
            const li = node("li", active ? "rot:flex rot:items-start rot:gap-3 rot:rounded-lg rot:bg-teal-600/10 rot:p-3 rot:ring-1 rot:ring-teal-600/30" : "rot:flex rot:items-start rot:gap-3 rot:rounded-lg rot:bg-stone-100 rot:p-3 rot:dark:bg-zinc-900");
            if (active) li.setAttribute("aria-current", "true");
            li.append(node("span", "rot:pt-0.5 rot:font-mono rot:text-xs rot:text-stone-500 rot:dark:text-zinc-400", String(index + 1).padStart(2, "0")));
            const description = node("div", "rot:min-w-0 rot:flex-1");
            description.append(node("p", "rot:m-0 rot:font-medium", tanda.orchestras.join(" / ") || "Orchestra not tagged"), node("p", "rot:mt-0.5 rot:mb-0 rot:text-xs rot:text-stone-500 rot:dark:text-zinc-400", tanda.singers.join(" / ") || "Singer not tagged"));
            const position = node("div", "rot:text-right rot:text-xs");
            const playedAt = new Date(tanda.playedAt);
            const time = node("time", "rot:whitespace-nowrap rot:font-mono rot:tabular-nums", playedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
            time.dateTime = playedAt.toISOString();
            time.title = playedAt.toLocaleString();
            position.append(time);
            if (active) position.append(node("p", "rot:mt-0.5 rot:mb-0 rot:font-semibold rot:text-teal-700 rot:dark:text-teal-300", "Current"));
            li.append(description, position);
            return li;
        }));
    }
    if (followNewTanda) {
        const list = byId("history");
        list.scrollTop = list.scrollHeight;
    }
}

function invalidate(message) {
    current = null;
    byId("playlist").textContent = message;
    renderHistory();
    renderRows();
}

async function refresh() {
    try {
        const [snapshot, appearance] = await Promise.all([readSnapshot(api), api.get("appearance")]);
        if (disposed) return;
        document.documentElement.dataset.theme = appearance.theme;
        byId("rotation").dataset.theme = appearance.theme;
        if (snapshot === null) {
            invalidate("Playback changed · refreshing…");
        } else {
            render(snapshot);
            byId("error").hidden = true;
        }
    } catch (error) {
        invalidate("Playback information unavailable");
        await reportError(error);
    } finally { if (!disposed) timer = setTimeout(refresh, 1000); }
}

function start() {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored !== null) {
            const previous = JSON.parse(stored);
            settings = migrateSettings(previous);
            if (settings.version !== previous.version) save(settings);
        }
    } catch (error) {
        void reportError(error, "settings-error");
        byId("save-status").textContent = "Could not load settings. Save to replace them.";
    }
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored !== null) history = validateHistory(JSON.parse(stored));
    } catch (error) {
        void reportError(error);
        return;
    }
    for (const rule of settings.rules) addCard(rule);
    byId("rules-form").addEventListener("input", markUnsaved);
    byId("rules-form").addEventListener("change", markUnsaved);
    byId("rules-form").addEventListener("submit", (event) => {
        event.preventDefault();
        try {
            const rules = [...byId("cards").children].map((card) => ({ orchestra: card.querySelector('[name="orchestra"]').value, minutes: Number(card.querySelector('[name="minutes"]').value) }));
            save({ version: 2, rules });
            byId("settings-error").hidden = true;
            byId("save-status").textContent = "Saved";
            renderRows();
        } catch (error) { void reportError(error, "settings-error"); }
    });
    byId("add").addEventListener("click", () => {
        addCard().focus();
        markUnsaved();
    });
    window.addEventListener("pagehide", () => { disposed = true; clearTimeout(timer); }, { once: true });
    void refresh();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
