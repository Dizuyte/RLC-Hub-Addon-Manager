/* RLC Hub Addon Manager (c) 2026 Milan. All rights reserved. See LICENSE.txt. */

;/* ===== RLC HUB+ : addon manager (end of main.js) ===== */
(function () {
  try {
    const path = require("path");
    const fs = require("fs");
    const electron = require("electron");
    const { createHub } = require("./rlc-hubplus/core.js");
    let gameVersion = null;
    try { gameVersion = require("./package.json").version || null; } catch (e) {}
    // <RLC Hub Addon Manager folder>\RL Career Hub\RL Career Hub.exe  ->  <RLC Hub Addon Manager folder>\addons
    const addonsDir = path.join(path.dirname(process.execPath), "..", "addons");
    try { fs.mkdirSync(addonsDir, { recursive: true }); } catch (e) {}
    const dirs = [process.env.HUBPLUS_ADDONS_DIR, addonsDir].filter(Boolean);
    // log file for addon makers: <RLC Hub Addon Manager folder>\addons\_hubplus.log (new file at each start)
    const logFile = path.join(dirs[0], "_hubplus.log");
    try { fs.writeFileSync(logFile, "RLC Hub Addon Manager log, " + new Date().toISOString() + "\r\n"); } catch (e) {}
    const log = (m) => {
      console.log("[hub+] " + m);
      try { fs.appendFileSync(logFile, new Date().toISOString().slice(11, 19) + " " + m + "\r\n"); } catch (e) {}
    };
    // read or replace a top-level function/value of main.js (addons: hub.get("main", ...) / hub.replace("main", ...))
    const mainBridge = function (name, value) {
      if (!/^[A-Za-z_$][\w$]*$/.test(String(name))) throw new Error("RLC Hub Addon Manager: bad name " + name);
      if (arguments.length > 1) eval(name + " = arguments[1]");
      return eval("typeof " + name + " === 'undefined' ? undefined : " + name);
    };
    const hub = createHub({
      electron, engine, dirs, gameVersion, mainBridge,
      getState: () => state,
      saveState: () => saveState(),
      snapshot: () => snapshot(),
      log,
    });
    global.__hubPlus = hub;
    // hook "watch-check" (RLC Hub Addon Manager puts it in main.js): is a match watched with these bots valid? true/false, or null = game's rule
    global.__hubWatchOk = function (stats) { try { return hub.runHook("watch-check", [stats]); } catch (e) { return null; } };
    hub.load();
    log(hub.addons.length + " addon(s) found in " + dirs.join(" + ") + (hub.problems.length ? ", " + hub.problems.length + " with a problem" : ""));
    for (const p of hub.problems) log("problem in " + p.folder + ": " + p.error);

    const prevSnap = snapshot;
    snapshot = function () {
      const s = prevSnap.apply(this, arguments);
      return hub.patchSnapshot(s, state);
    };
    ipcMain.handle("hubplus-list", () => ({ list: hub.listView(), on: state ? Array.from(hub.ensure(state)) : null, pending: hub.pending, defaults: hub.defaults() }));
    ipcMain.handle("hubplus-pending", (_e, ids) => ({ ok: true, on: hub.setPending(Array.isArray(ids) ? ids : []) }));
    ipcMain.handle("hubplus-call", (_e, id, name, payload) => hub.runAction(String(id || ""), String(name || ""), payload));
    ipcMain.handle("hubplus-open-folder", () => electron.shell.openPath(addonsDir));
    ipcMain.handle("hubplus-edit-save", (_e, ids) => {
      const r = hub.editSave(state, Array.isArray(ids) ? ids.map(String) : []);
      if (!r.ok) return r;
      try { saveState(); } catch (e) { log("save: " + e.message); }
      return { ok: true, on: r.on, snapshot: snapshot() };
    });
    electron.app.whenReady().then(() => hub.attachWindows()).catch((e) => console.error("[hub+] windows", e));
  } catch (err) { console.error("[hub+] main", err); }
})();
