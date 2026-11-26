/* RLC Hub+ (c) 2026 Milan. All rights reserved. See LICENSE.txt. */

;/* ===== RLC HUB+ : addon manager (end of renderer/app.js) =====
   - new-career screen: pick the addons of the save (locked once the save is created)
   - Setup tab: addons of the loaded save, with their authors (read only) + RLC Hub+ credit
   - window.__hubPlusActiveList(): addons on right now (also used by the sandbox that runs the addons' UIs) */
(function () {
  "use strict";
  var HUBPLUS_VERSION = "1.0";
  var TEXTS = {
    fr: {
      "Addons for this save": "Addons de cette save",
      "Pick them now: they can not be changed once the career has started.": "Choisis-les maintenant : impossible de les changer une fois la carrière lancée.",
      "No addon installed. Put addon folders in {dir}, then restart RLC Hub+.": "Aucun addon installé. Mets les dossiers d'addons dans {dir}, puis relance RLC Hub+.",
      "Open the addons folder": "Ouvrir le dossier des addons",
      "by {author}": "par {author}",
      "On": "Activé",
      "Off": "Désactivé",
      "Default addons": "Addons par défaut",
      "No addons": "Aucun addon",
      "Replaces {addon} (only one per save).": "Remplace {addon} (un seul par save).",
      "Also turns on: {list}.": "Active aussi : {list}.",
      "Also turns off: {list}.": "Désactive aussi : {list}.",
      "Can not be used: needs {list}, which is not installed.": "Inutilisable : il faut {list}, qui n'est pas installé.",
      "Could not load: {error}": "Chargement impossible : {error}",
      "Made for RL Career Hub {v}.": "Fait pour RL Career Hub {v}.",
      "Addons with a problem": "Addons avec un problème",
      "Addons of this save": "Addons de cette save",
      "No addons.": "Aucun addon.",
      "Picked when the career was created, they can not be changed.": "Choisis à la création de la carrière, ils ne peuvent pas être changés.",
      "RLC Hub+ v{v} by Milan. All rights reserved. Addons belong to their authors.": "RLC Hub+ v{v} par Milan. Tous droits réservés. Les addons appartiennent à leurs auteurs.",
    },
  };
  var R = { list: null, pick: null, sent: "", lang: {}, loading: false };
  function e2(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function T(k, vars) {
    var s;
    try { s = typeof tl === "function" ? tl(k, vars) : k; } catch (e) { s = k; }
    if (vars && s.indexOf("{") >= 0) for (var v in vars) s = s.split("{" + v + "}").join(vars[v]);
    return s;
  }
  function meta() { return typeof S !== "undefined" && S && S.hubPlus ? S.hubPlus : null; }
  function view() { var m = meta(); return (m && m.list) || R.list || null; }
  function all() { var v = view(); return (v && v.addons) || []; }
  function byId(id) { return all().find(function (a) { return a.id === id; }) || null; }
  function usable(a) { return a && !a.missing && !a.failed; }

  // RLC Hub+ texts and each addon's own "lang" (addon.json) in the game's language system (English = key)
  function installLang() {
    var packs = typeof I18N_PACKS !== "undefined" ? I18N_PACKS : window.I18N_PACKS;
    if (!packs) return;
    var add = function (key, src) {
      if (R.lang[key] || !src) return;
      R.lang[key] = true;
      Object.keys(src).forEach(function (lang) {
        var pack = packs[lang], mine = src[lang];
        if (!pack || !mine) return;
        for (var k in mine) if (!Object.prototype.hasOwnProperty.call(pack, k)) pack[k] = mine[k];
      });
    };
    add("_hubplus", TEXTS);
    all().forEach(function (a) { add(a.id, a.lang); });
  }

  // same rules as core.js normalize(): requires pulled in, one addon per group, conflicts, unusable ones dropped
  function normalize(list) {
    var want = [];
    function add(id, depth) {
      var a = byId(id);
      if (!usable(a) || want.indexOf(id) >= 0 || depth > 20) return;
      (a.requires || []).forEach(function (r) { add(r, depth + 1); });
      var clash = want.some(function (o) {
        var b = byId(o);
        return (a.group && b.group === a.group) || (a.conflicts || []).indexOf(o) >= 0 || (b.conflicts || []).indexOf(id) >= 0;
      });
      if (!clash && (a.requires || []).every(function (r) { return want.indexOf(r) >= 0; })) want.push(id);
    }
    (list || []).forEach(function (id) { add(id, 0); });
    return all().map(function (a) { return a.id; }).filter(function (id) { return want.indexOf(id) >= 0; });
  }
  function defaults() { return normalize(all().filter(function (a) { return a.default; }).map(function (a) { return a.id; })); }
  function needs(o, id, seen) {
    var a = byId(o);
    if (!a || seen[o]) return false;
    seen[o] = 1;
    return (a.requires || []).some(function (r) { return r === id || needs(r, id, seen); });
  }
  function dependents(id, picked) { return picked.filter(function (o) { return o !== id && needs(o, id, {}); }); }
  function names(ids) { return ids.map(function (r) { var b = byId(r); return b ? T(b.name) : r; }).join(", "); }

  // on the new-career screen: its picker is in the page, or preStartHtml ran a moment ago (render in progress)
  function creating() {
    if (!window.__hubPlusCreating) return false;
    if (Date.now() - R.preAt < 300) return true;
    if (document.querySelector(".pre-go")) return true;
    window.__hubPlusCreating = false;
    return false;
  }
  R.preAt = 0;
  window.__hubPlusActiveList = function () {
    var m = meta();
    if (creating() && Array.isArray(window.__hubPlusPending)) return window.__hubPlusPending;
    var c = typeof S !== "undefined" && S ? S.career : null;
    if (c && c.hubPlus && Array.isArray(c.hubPlus.on)) return c.hubPlus.on;
    if (c && m && Array.isArray(m.on)) return m.on;
    if (c) return [];
    if (m && Array.isArray(m.pending)) return m.pending;
    return all().filter(function (a) { return a.menu; }).map(function (a) { return a.id; });
  };
  window.__hubPlusOn = window.__hubPlusOn || function (id) { return window.__hubPlusActiveList().indexOf(id) >= 0; };

  function send(force) {
    var k = (R.pick || []).join(",");
    window.__hubPlusPending = (R.pick || []).slice();
    if ((!force && k === R.sent) || !window.hubPlus) return;
    R.sent = k;
    window.hubPlus.setPending(R.pick || []).then(function (r) {
      if (r && Array.isArray(r.on) && r.on.join(",") !== k) { R.pick = r.on; R.sent = r.on.join(","); window.__hubPlusPending = r.on.slice(); render(); }
    }).catch(function (e) { console.error("[hub+]", e); });
  }
  function ensureList() {
    if (view() || R.loading || !window.hubPlus) return;
    R.loading = true;
    window.hubPlus.list().then(function (r) { R.list = (r && r.list) || { addons: [], problems: [] }; R.loading = false; render(); }).catch(function () { R.loading = false; });
  }

  function addonButton(a, picked) {
    var onNow = picked.indexOf(a.id) >= 0, why = [];
    if (a.missing) why.push(T("Can not be used: needs {list}, which is not installed.", { list: a.missing.join(", ") }));
    if (a.failed) why.push(T("Could not load: {error}", { error: a.failed }));
    if (a.wrongGame) why.push(T("Made for RL Career Hub {v}.", { v: a.game }));
    if (usable(a) && !onNow) {
      var g = a.group && picked.find(function (o) { var b = byId(o); return b && b.group === a.group; });
      if (g) why.push(T("Replaces {addon} (only one per save).", { addon: T(byId(g).name) }));
      var miss = (a.requires || []).filter(function (r) { return picked.indexOf(r) < 0; });
      if (miss.length) why.push(T("Also turns on: {list}.", { list: names(miss) }));
    } else if (onNow) {
      var deps = dependents(a.id, picked);
      if (deps.length) why.push(T("Also turns off: {list}.", { list: names(deps) }));
    }
    var tip = [T(a.description || ""), T("by {author}", { author: a.author }) + (a.version ? " · v" + a.version : "")].concat(why).filter(Boolean).join("\n");
    return '<button class="pre-diff hubplus-addon' + (onNow ? " on" : "") + '" data-action="hubplus-addon" data-id="' + e2(a.id) + '" aria-pressed="' + onNow + '"' +
      (usable(a) ? "" : ' disabled style="opacity:.45;cursor:not-allowed"') + ' title="' + e2(tip) + '"><span class="pre-diff-k">' + e2(T(a.name)) +
      '</span><span class="pre-diff-v">' + e2(onNow ? T("On") : T("Off")) + (a.author ? " · " + e2(a.author) : "") + "</span></button>";
  }
  function pickerHtml() {
    var v = view();
    if (!v) { ensureList(); return ""; }
    installLang();
    var list = all();
    var head = '<div class="pre-field hubplus-pick"><span>' + e2(T("Addons for this save")) + "</span>";
    if (!list.length) {
      return head + '<div class="pre-note">' + e2(T("No addon installed. Put addon folders in {dir}, then restart RLC Hub+.", { dir: v.dir || "addons" })) + "</div>" +
        '<div style="margin-top:6px"><button class="ptab" data-action="hubplus-folder" style="cursor:pointer">' + e2(T("Open the addons folder")) + "</button></div></div>";
    }
    if (!R.pick) R.pick = defaults();
    send(false);
    var picked = R.pick;
    var bad = (v.problems || []).map(function (p) { return e2(p.folder) + ": " + e2(p.error); });
    return head + '<div class="pre-note">' + e2(T("Pick them now: they can not be changed once the career has started.")) + "</div>" +
      '<div class="pre-series" role="group" style="flex-wrap:wrap;margin-top:6px">' + list.map(function (a) { return addonButton(a, picked); }).join("") + "</div>" +
      '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="ptab" data-action="hubplus-defaults" style="cursor:pointer">' + e2(T("Default addons")) + "</button>" +
      '<button class="ptab" data-action="hubplus-none" style="cursor:pointer">' + e2(T("No addons")) + "</button>" +
      '<button class="ptab" data-action="hubplus-folder" style="cursor:pointer">' + e2(T("Open the addons folder")) + "</button></div>" +
      (bad.length ? '<div class="pre-note" style="margin-top:6px">' + e2(T("Addons with a problem")) + ": " + bad.join(" · ") + "</div>" : "") +
      "</div>";
  }

  try {
    var origPre = preStartHtml;
    preStartHtml = function () {
      window.__hubPlusCreating = true;
      R.preAt = Date.now();
      var html = origPre.apply(this, arguments);
      var anchor = '<button class="btn primary pre-go"';
      var box = "";
      try { box = pickerHtml(); } catch (e) { console.error("[hub+] picker", e); }
      return box && html.indexOf(anchor) >= 0 ? html.replace(anchor, box + anchor) : html;
    };
  } catch (e) { console.error("[hub+] picker hook", e); }

  document.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-action^="hubplus-"]') : null;
    if (el) {
      ev.preventDefault(); ev.stopPropagation();
      var act = el.dataset.action, picked = (R.pick || defaults()).slice();
      if (act === "hubplus-folder") { if (window.hubPlus) window.hubPlus.openFolder(); return; }
      if (act === "hubplus-defaults") R.pick = defaults();
      else if (act === "hubplus-none") R.pick = [];
      else if (act === "hubplus-addon") {
        var id = el.dataset.id, a = byId(id);
        if (!usable(a)) return;
        if (picked.indexOf(id) >= 0) {
          var drop = dependents(id, picked).concat([id]);
          R.pick = picked.filter(function (x) { return drop.indexOf(x) < 0; });
        } else {
          // the new one wins: what clashes with it goes, and so does what needed the ones that went
          var keep = picked.filter(function (o) { var b = byId(o); return !(a.group && b && b.group === a.group) && (a.conflicts || []).indexOf(o) < 0 && (b.conflicts || []).indexOf(id) < 0; });
          picked.filter(function (o) { return keep.indexOf(o) < 0; }).forEach(function (g) { keep = keep.filter(function (x) { return dependents(g, picked).indexOf(x) < 0; }); });
          R.pick = normalize([id].concat(keep));
        }
      } else return;
      send(false); render();
      return;
    }
    var go = ev.target && ev.target.closest ? ev.target.closest('[data-action="pre-start"]') : null;
    if (go && R.pick) send(true); // sent again right before the game's own "new career" call
  }, true);

  /* Setup tab: RLC Hub+ credit + addons of the loaded save */
  try {
    if (typeof doctorHtml === "function") {
      var origDoc = doctorHtml;
      doctorHtml = function () {
        var html = origDoc.apply(this, arguments);
        try {
          installLang();
          var c = typeof S !== "undefined" && S ? S.career : null;
          var onList = c && c.hubPlus && Array.isArray(c.hubPlus.on) ? c.hubPlus.on : null;
          var box = "";
          if (onList) {
            var rows = onList.map(function (id) {
              var a = byId(id);
              if (!a) return '<div style="opacity:.7">' + e2(id) + "</div>";
              return '<div style="margin-top:4px"><b>' + e2(T(a.name)) + "</b>" + (a.version ? " v" + e2(a.version) : "") + " · " + e2(T("by {author}", { author: a.author })) +
                (a.license ? ' <span style="opacity:.6">(' + e2(a.license) + ")</span>" : "") + "</div>";
            }).join("");
            box = '<div style="letter-spacing:.06em;text-transform:uppercase;opacity:.7">' + e2(T("Addons of this save")) + "</div>" +
              (rows || '<div style="opacity:.7">' + e2(T("No addons.")) + "</div>") +
              '<div style="margin-top:6px;opacity:.6">' + e2(T("Picked when the career was created, they can not be changed.")) + "</div>";
          }
          return html + '<div class="hubplus-setup" style="margin:18px 0 4px;font-size:12px">' + box +
            '<div style="margin-top:10px;text-align:center;letter-spacing:.06em;opacity:.6">' + e2(T("RLC Hub+ v{v} by Milan. All rights reserved. Addons belong to their authors.", { v: HUBPLUS_VERSION })) + "</div></div>";
        } catch (e) { console.error("[hub+] setup", e); return html; }
      };
    }
  } catch (e) { console.error("[hub+] setup hook", e); }
})();
