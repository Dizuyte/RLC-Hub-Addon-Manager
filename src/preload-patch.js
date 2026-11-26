/* RLC Hub Addon Manager (c) 2026 Milan. All rights reserved. See LICENSE.txt. */

;/* ===== RLC HUB+ : addon manager (end of preload.js) ===== */
(function () {
  try {
    var e = require("electron");
    e.contextBridge.exposeInMainWorld("hubPlus", {
      list: function () { return e.ipcRenderer.invoke("hubplus-list"); },
      setPending: function (ids) { return e.ipcRenderer.invoke("hubplus-pending", Array.isArray(ids) ? ids.map(String) : []); },
      // run an action an addon registered with hub.action(name, fn) in its main.js; resolves { ok, result, snapshot, error }
      call: function (id, name, payload) { return e.ipcRenderer.invoke("hubplus-call", String(id), String(name), payload === undefined ? null : payload); },
      openFolder: function () { return e.ipcRenderer.invoke("hubplus-open-folder"); },
      // Setup tab: change the addons of the loaded save (the game window asks for two confirmations first)
      editSave: function (ids) { return e.ipcRenderer.invoke("hubplus-edit-save", Array.isArray(ids) ? ids.map(String) : []); },
    });
  } catch (err) { console.error("[hub+] preload", err); }
})();
