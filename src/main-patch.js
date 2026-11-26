/* RLC Hub+ (c) 2026 Milan. All rights reserved. See LICENSE.txt. */

;/* ===== RLC HUB+ : addon manager (end of main.js) ===== */
(function () {
  try {
    const path = require("path");
    const fs = require("fs");
    const electron = require("electron");
    const { createHub } = require("./rlc-hubplus/core.js");
    let gameVersion = null;
    try { gameVersion = require("./package.json").version || null; } catch (e) {}
    // <RLC Hub+ folder>\RL Career Hub\RL Career Hub.exe  ->  <RLC Hub+ folder>\addons
    const addonsDir = path.join(path.dirname(process.execPath), "..", "addons");
    try { fs.mkdirSync(addonsDir, { recursive: true }); } catch (e) {}
    const dirs = [process.env.HUBPLUS_ADDONS_DIR, addonsDir].filter(Boolean);
    // log file for addon makers: <RLC Hub+ folder>\addons\_hubplus.log (new file at each start)
    const logFile = path.join(dirs[0], "_hubplus.log");
    try { fs.writeFileSync(logFile, "RLC Hub+ log, " + new Date().toISOString() + "\r\n"); } catch (e) {}
    const log = (m) => {
      console.log("[hub+] " + m);
      try { fs.appendFileSync(logFile, new Date().toISOString().slice(11, 19) + " " + m + "\r\n"); } catch (e) {}
    };
    const hub = createHub({
      electron, engine, dirs, gameVersion,
      getState: () => state,
      saveState: () => saveState(),
      snapshot: () => snapshot(),
      log,
    });
    global.__hubPlus = hub;
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
    electron.app.whenReady().then(() => hub.attachWindows()).catch((e) => console.error("[hub+] windows", e));
  } catch (err) { console.error("[hub+] main", err); }
})();
