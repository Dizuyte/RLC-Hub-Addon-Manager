/* RLC Hub+ (c) 2026 Milan. All rights reserved. See LICENSE.txt.
   Addon manager, main process. Installed inside the game as rlc-hubplus/core.js and started from main.js.
   - every folder <RLC Hub+ folder>\addons\<folder> with an addon.json is an addon
   - the addons of a save are picked on the new-career screen and stored in state.hubPlus (locked after that)
   - every engine function an addon wraps is gated: the addon's version runs only for saves that have the addon,
     every other save goes straight to the function underneath (the game's, or the addon loaded before)
   - the addons' UI files run in the game window through the sandbox (sandbox.js), gated the same way
   Guide for addon makers: docs/ADDONS.md */
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = 1;
const ID_RE = /^[a-z0-9][a-z0-9-]{1,47}$/;

function createHub(env) {
  const log = env.log || ((m) => console.log("[hub+] " + m));
  const getState = env.getState || (() => null);
  const gameVersion = env.gameVersion || null;

  /* ---------- addons on disk ---------- */
  const addons = [];          // manifests, in load order
  const byId = new Map();
  const problems = [];        // { folder, error } shown in the picker
  function readJson(f) { return JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, "")); }
  for (const dir of env.dirs || []) {
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch (e) { continue; }
    for (const folder of names) {
      if (folder.startsWith(".") || folder.startsWith("_")) continue; // _disabled, .git ...
      const root = path.join(dir, folder);
      const mf = path.join(root, "addon.json");
      if (!fs.existsSync(mf)) continue;
      let a;
      try { a = readJson(mf); } catch (e) { problems.push({ folder, error: "addon.json: " + e.message }); continue; }
      if (!a || typeof a !== "object" || !ID_RE.test(String(a.id || ""))) { problems.push({ folder, error: "addon.json: missing or bad \"id\" (lowercase letters, digits and -)" }); continue; }
      if (byId.has(a.id)) { problems.push({ folder, error: "two addons use the id " + a.id }); continue; }
      a.root = root;
      a.folder = folder;
      a.name = String(a.name || a.id);
      a.author = String(a.author || "?");
      a.version = String(a.version || "");
      a.description = String(a.description || "");
      a.requires = Array.isArray(a.requires) ? a.requires.map(String) : [];
      a.conflicts = Array.isArray(a.conflicts) ? a.conflicts.map(String) : [];
      a.group = a.group ? String(a.group) : null;
      a.order = Number.isFinite(a.order) ? a.order : 100;
      a.ui = Array.isArray(a.ui) ? a.ui.map(String) : a.ui ? [String(a.ui)] : [];
      a.legacyKeys = Array.isArray(a.legacyKeys) ? a.legacyKeys.map(String) : [];
      a.wrongGame = !!(a.game && gameVersion && String(a.game) !== gameVersion);
      byId.set(a.id, a);
      addons.push(a);
    }
  }
  addons.sort((x, y) => x.order - y.order || x.id.localeCompare(y.id));
  for (const a of addons) {
    const missing = a.requires.filter((r) => !byId.has(r));
    if (missing.length) a.missing = missing; // can not be picked
  }

  /* ---------- which addons a save has ---------- */
  // Adds what is required, drops what clashes with an addon picked before it (same group, conflicts), drops what can not load.
  function normalize(list) {
    const want = [];
    const add = (id, depth) => {
      const a = byId.get(id);
      if (!a || a.missing || want.includes(id) || depth > 20) return;
      for (const r of a.requires) add(r, depth + 1);
      const clash = want.some((o) => {
        const b = byId.get(o);
        return (a.group && b.group === a.group) || a.conflicts.includes(o) || b.conflicts.includes(id);
      });
      if (!clash && a.requires.every((r) => want.includes(r))) want.push(id);
    };
    for (const id of Array.isArray(list) ? list : []) add(String(id), 0);
    return addons.map((a) => a.id).filter((id) => want.includes(id)); // load order
  }
  function defaults() { return normalize(addons.filter((a) => a.default).map((a) => a.id)); }
  // A save made before RLC Hub+ (imported from the normal game): no addon, except the ones whose data is already in it.
  function infer(st) { return normalize(addons.filter((a) => a.legacyKeys.some((k) => st[k] != null)).map((a) => a.id)); }
  const cache = new WeakMap();
  function ensure(st) {
    if (!st || typeof st !== "object") return new Set();
    let rec = st.hubPlus;
    if (!rec || typeof rec !== "object" || !Array.isArray(rec.on)) {
      rec = st.hubPlus = { v: VERSION, on: infer(st), imported: true, locked: true };
      log("save from before RLC Hub+: addons " + (rec.on.join(", ") || "none"));
    }
    let c = cache.get(rec);
    if (!c || c.src !== rec.on || c.len !== rec.on.length) { c = { src: rec.on, len: rec.on.length, set: new Set(rec.on) }; cache.set(rec, c); }
    return c.set;
  }
  const isState = (a) => !!a && typeof a === "object" && Array.isArray(a.teams) && Array.isArray(a.players);

  let pending = null;   // Set picked on the new-career screen, before the save exists
  let creating = null;  // Set used while engine.generateLeague builds the new save
  function setPending(list) { pending = new Set(normalize(list)); return Array.from(pending); }
  function activeSet(st) {
    if (creating) return creating;
    if (isState(st)) return ensure(st);
    if (pending) return pending;
    const cur = getState();
    return isState(cur) ? ensure(cur) : new Set();
  }
  function on(st, id) { return activeSet(st).has(id); }
  function onArgs(id, args) {
    if (creating) return creating.has(id);
    for (let i = 0; i < Math.min(args.length, 3); i++) if (isState(args[i])) return ensure(args[i]).has(id);
    return activeSet(null).has(id);
  }

  /* ---------- gating ---------- */
  // Runs install(); every function it replaced on the targets becomes a dispatcher: the addon's version for saves with
  // the addon, the previous one otherwise. Functions it added are left as they are (only the addon calls them).
  function gate(id, install, targets) {
    targets = (targets || [env.engine]).filter((t) => t && (typeof t === "object" || typeof t === "function"));
    const before = targets.map((t) => { const m = new Map(); for (const k of Object.keys(t)) m.set(k, t[k]); return m; });
    let ok = true;
    try { install(); } catch (e) { ok = false; log(id + ": failed: " + (e && e.stack || e)); }
    targets.forEach((t, i) => {
      for (const k of Object.keys(t)) {
        const now = t[k], prev = before[i].get(k);
        if (typeof now !== "function" || typeof prev !== "function" || now === prev || now.__hubPlusAddon === id) continue;
        const gated = function () { return onArgs(id, arguments) ? now.apply(this, arguments) : prev.apply(this, arguments); };
        for (const p of Object.keys(now)) { try { gated[p] = now[p]; } catch (e) {} }
        gated.__hubPlusAddon = id;
        try { t[k] = gated; } catch (e) { log(id + ": could not gate " + k + ": " + e.message); }
      }
    });
    return ok;
  }

  /* ---------- new save: the picked list goes into the state ---------- */
  function wrapGenerate(engine) {
    const gen = engine.generateLeague;
    if (typeof gen !== "function" || gen.__hubPlusRoot) return;
    engine.generateLeague = function () {
      const set = pending || new Set(defaults());
      const prev = creating;
      creating = set;
      try {
        const st = gen.apply(this, arguments);
        if (st && typeof st === "object") st.hubPlus = { v: VERSION, on: Array.from(set), locked: true, created: st.currentDate || null };
        log("new save, addons: " + (Array.from(set).join(", ") || "none"));
        pending = null;
        return st;
      } finally { creating = prev; }
    };
    engine.generateLeague.__hubPlusRoot = true;
  }

  /* ---------- what addons register ---------- */
  const uiParts = [];   // { id, file, code }
  const snapHooks = []; // { id, fn }
  const actions = new Map(); // "id/name" -> fn
  function listView() {
    return {
      addons: addons.map((a) => ({
        id: a.id, name: a.name, author: a.author, version: a.version, description: a.description,
        requires: a.requires, conflicts: a.conflicts, group: a.group, default: !!a.default, menu: !!a.menu,
        missing: a.missing || null, wrongGame: a.wrongGame, game: a.game || null, url: a.url || null, license: a.license || null,
        failed: a.failed || null, lang: a.lang || null,
      })),
      problems,
      dir: (env.dirs || [])[(env.dirs || []).length - 1] || null,
    };
  }
  function patchSnapshot(s, st) {
    if (!s || typeof s !== "object") return s;
    try {
      const set = isState(st) ? ensure(st) : null;
      s.hubPlus = { on: set ? Array.from(set) : null, pending: pending ? Array.from(pending) : null, list: listView() };
      if (set) for (const h of snapHooks) if (set.has(h.id)) { try { h.fn(s, st); } catch (e) { log(h.id + ": onSnapshot: " + e.message); } }
    } catch (e) { log("snapshot: " + e.message); }
    return s;
  }
  function cachedModule(re) {
    for (const k of Object.keys(Module._cache)) if (re.test(k)) return Module._cache[k].exports;
    return null;
  }

  /* ---------- loading ---------- */
  function load() {
    const engine = env.engine;
    if (!engine) { log("engine not found, no addon loaded"); return; }
    const leagueKey = Object.keys(Module._cache).find((k) => /engine[\\/]league\.js$/.test(k));
    for (const a of addons) {
      if (a.missing) { log(a.id + ": not loaded, needs " + a.missing.join(", ")); continue; }
      const alog = (m) => log(a.id + ": " + m);
      // the object an addon's main.js receives (see docs/ADDONS.md)
      const hub = {
        id: a.id, dir: a.root, manifest: a, log: alog, version: VERSION, gameVersion,
        engine,
        events: cachedModule(/engine[\\/]events\.js$/),
        titles: cachedModule(/engine[\\/]titles\.js$/),
        world: cachedModule(/engine[\\/]world\.js$/),
        gameDir: leagueKey ? path.join(path.dirname(leagueKey), "..") : null,
        electron: env.electron,
        module: cachedModule,
        state: () => getState(),
        save: () => { try { env.saveState(); } catch (e) { alog("save failed: " + e.message); } },
        // the addon's own place in the save (saved with it): state.hubPlusData[<id>]
        data: (st) => {
          st = st || getState();
          if (!st || typeof st !== "object") return null;
          const all = st.hubPlusData && typeof st.hubPlusData === "object" ? st.hubPlusData : (st.hubPlusData = {});
          return all[a.id] && typeof all[a.id] === "object" ? all[a.id] : (all[a.id] = {});
        },
        isOn: (st) => on(st === undefined ? getState() : st, a.id),
        has: (st, other) => on(st, other),
        wrap: (targets, install) => {
          if (typeof targets === "function") { install = targets; targets = null; }
          return gate(a.id, install, targets ? (Array.isArray(targets) ? targets : [targets]) : null);
        },
        action: (name, fn) => { if (typeof fn === "function") actions.set(a.id + "/" + name, fn); },
        onSnapshot: (fn) => { if (typeof fn === "function") snapHooks.push({ id: a.id, fn }); },
      };
      if (a.main) {
        try {
          const mod = require(path.join(a.root, a.main));
          const fn = typeof mod === "function" ? mod : mod && mod.main;
          if (typeof fn !== "function") throw new Error(a.main + " must export a function: module.exports = function (hub) { ... }");
          // everything the addon wraps while main() runs is gated automatically
          gate(a.id, () => fn(hub), [engine]);
          alog("loaded" + (a.wrongGame ? " (made for game " + a.game + ", this is " + gameVersion + ")" : ""));
        } catch (e) { a.failed = String(e && e.message || e); alog("failed to load: " + (e && e.stack || e)); }
      }
      for (const f of a.ui) {
        try { uiParts.push({ id: a.id, file: f, code: fs.readFileSync(path.join(a.root, f), "utf8") }); } catch (e) { alog("ui file " + f + ": " + e.message); }
      }
    }
    wrapGenerate(engine); // outermost, so the picked list is known while every addon's generateLeague runs
  }

  /* ---------- actions: renderer -> main ---------- */
  async function runAction(id, name, payload) {
    const st = getState();
    const fn = actions.get(id + "/" + name);
    if (!fn) return { ok: false, error: "unknown action " + id + "/" + name };
    if (!isState(st) || !on(st, id)) return { ok: false, error: "this save does not have the addon " + id };
    let result;
    try { result = await fn(payload, st); } catch (e) { log(id + "/" + name + ": " + (e && e.stack || e)); return { ok: false, error: String(e && e.message || e) }; }
    // read-only actions ({ save: false }) skip the save and the (big) snapshot
    if (result && result.save === false) return { ok: true, result, snapshot: null };
    try { env.saveState(); } catch (e) { log("save: " + e.message); }
    return { ok: true, result, snapshot: env.snapshot ? env.snapshot() : null };
  }

  /* ---------- game window ---------- */
  function attachWindows() {
    const { app, BrowserWindow } = env.electron;
    const sandbox = fs.readFileSync(path.join(__dirname, "sandbox.js"), "utf8");
    const parts = uiParts.map((u) =>
      ";window.__hubPlusUI&&window.__hubPlusUI.begin(" + JSON.stringify(u.id) + ");\n" + u.code +
      "\n;window.__hubPlusUI&&window.__hubPlusUI.end(" + JSON.stringify(u.id) + ");\n//# sourceURL=hubplus-addon://" + u.id + "/" + u.file);
    const inject = (wc) => {
      try {
        if (!/renderer.index\.html/.test(wc.getURL())) return;
        let chain = wc.executeJavaScript(sandbox);
        for (const code of parts) {
          // one script per file: an error in one addon does not stop the others
          chain = chain.then(() => wc.executeJavaScript(code).catch((e) => log("ui error: " + e.message)))
            .then(() => wc.executeJavaScript("window.__hubPlusUI&&window.__hubPlusUI.end(null)").catch(() => {}));
        }
        chain.then(() => wc.executeJavaScript("window.__hubPlusUI&&window.__hubPlusUI.sync()")).catch((e) => log("ui inject: " + e.message));
      } catch (e) { log("ui inject: " + e.message); }
    };
    const watch = (w) => {
      if (!w || !w.webContents) return;
      w.webContents.on("did-finish-load", () => inject(w.webContents));
      // errors of addon UIs (and their console.log("[hub+] ...") lines) go to the log file too
      w.webContents.on("console-message", (_e, level, message, line, source) => {
        try {
          const fromAddon = /^hubplus-addon:/.test(String(source || ""));
          if (String(message).indexOf("[hub+]") >= 0 || (fromAddon && level >= 3)) log("ui: " + message + (fromAddon ? " (" + source + ":" + line + ")" : ""));
        } catch (e) {}
      });
    };
    BrowserWindow.getAllWindows().forEach((w) => { watch(w); if (!w.webContents.isLoading()) inject(w.webContents); });
    app.on("browser-window-created", (_e, w) => watch(w));
  }

  return {
    VERSION, addons, byId, problems, normalize, defaults, infer, ensure, setPending, activeSet, on, onArgs, gate,
    load, attachWindows, patchSnapshot, listView, runAction, isState,
    get pending() { return pending ? Array.from(pending) : null; },
  };
}

module.exports = { createHub };
