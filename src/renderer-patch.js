/* RLC Hub Addon Manager (c) 2026 Milan. All rights reserved. See LICENSE.txt. */

;/* ===== RLC HUB+ : addon manager (end of renderer/app.js) =====
   - new-career screen: pick the addons of the save (locked once the save is created)
   - Setup tab: addons of the loaded save with their authors, changing them (two warnings first) + RLC Hub Addon Manager credit
   - window.__hubPlusActiveList(): addons on right now (also used by the sandbox that runs the addons' UIs) */
(function () {
  "use strict";
  var HUBPLUS_VERSION = "1.1";
  var TEXTS = {
    fr: {
      "Addons for this save": "Addons de cette save",
      "Pick them now: changing them once the career has started is possible from the Setup tab, but it can break the save.": "Choisis-les maintenant : les changer une fois la carrière lancée est possible depuis l'onglet Setup, mais ça peut casser la save.",
      "These addons come from different people ({authors}). Some of them may not work together or may crash the game.": "Ces addons viennent de personnes différentes ({authors}). Certains pourraient ne pas fonctionner ensemble ou faire crasher le jeu.",
      "Change the addons of this save": "Changer les addons de cette save",
      "Apply": "Appliquer",
      "Cancel": "Annuler",
      "not installed": "pas installé",
      "Warning: this can break your save": "Attention : ça peut casser ta save",
      "Last warning": "Dernier avertissement",
      "Changing the addons of a career that has started can corrupt the save. It could stay broken for up to one in-game year, or be lost forever.": "Changer les addons d'une carrière déjà lancée peut corrompre la save. Elle pourrait rester cassée jusqu'à un an dans le jeu, ou être perdue pour toujours.",
      "Addons you turn off leave their data in the save; addons you turn on start from today, without what they would have done before.": "Les addons désactivés laissent leurs données dans la save ; les addons activés démarrent d'aujourd'hui, sans ce qu'ils auraient fait avant.",
      "Are you sure? What happens to the save can not be undone. Make a copy of the save first if you care about it.": "Tu es sûr ? Ce qui arrive à la save ne peut pas être annulé. Fais d'abord une copie de la save si tu y tiens.",
      "I understand, continue": "J'ai compris, continuer",
      "Yes, change the addons of this save": "Oui, changer les addons de cette save",
      "Could not change the addons.": "Impossible de changer les addons.",
      "Addons of this save changed. Restart RLC Hub Addon Manager if something looks wrong.": "Addons de la save changés. Relance RLC Hub Addon Manager si quelque chose cloche.",
      "No addon installed. Put addon folders in {dir}, then restart RLC Hub Addon Manager.": "Aucun addon installé. Mets les dossiers d'addons dans {dir}, puis relance RLC Hub Addon Manager.",
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
      "Manager career only.": "Carrière manager uniquement.",
      "Player career only.": "Carrière joueur uniquement.",
      "Off in this save.": "Désactivé dans cette save.",
      "Addons with a problem": "Addons avec un problème",
      "Addons of this save": "Addons de cette save",
      "No addons.": "Aucun addon.",
      "RLC Hub Addon Manager v{v} by Milan. All rights reserved. Addons belong to their authors.": "RLC Hub Addon Manager v{v} par Milan. Tous droits réservés. Les addons appartiennent à leurs auteurs.",
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
  function usable(a) { return a && !a.missing && !a.failed && fitsCareer(a); }
  // the career being made (new-career screen) or the loaded one: "manager" or "player"
  function careerType() {
    if (creating()) { try { return typeof preMode !== "undefined" && preMode === "player" ? "player" : "manager"; } catch (e) { return "manager"; } }
    var c = typeof S !== "undefined" && S ? S.career : null;
    return c && c.mode === "player" ? "player" : "manager";
  }
  function fitsCareer(a) { return !a || !Array.isArray(a.careers) || a.careers.indexOf(careerType()) >= 0; }

  // RLC Hub Addon Manager texts and each addon's own "lang" (addon.json) in the game's language system (English = key)
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
  // hidden libraries stay only while a picked addon needs them
  function prune(list) {
    return list.filter(function (id) {
      var a = byId(id);
      return !(a && a.hidden) || list.some(function (o) { return o !== id && needs(o, id, {}); });
    });
  }
  function names(ids) { return ids.filter(function (r) { var b = byId(r); return !(b && b.hidden); }).map(function (r) { var b = byId(r); return b ? T(b.name) : r; }).join(", "); }

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
    if (c && m && Array.isArray(m.on)) return m.on; // what really runs in this save (addons for the other career type are left out)
    if (c && c.hubPlus && Array.isArray(c.hubPlus.on)) return c.hubPlus.on;
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

  function addonButton(a, picked, action) {
    var onNow = picked.indexOf(a.id) >= 0, why = [];
    if (a.missing) why.push(T("Can not be used: needs {list}, which is not installed.", { list: a.missing.join(", ") }));
    if (a.failed) why.push(T("Could not load: {error}", { error: a.failed }));
    if (a.wrongGame) why.push(T("Made for RL Career Hub {v}.", { v: a.game }));
    if (!fitsCareer(a)) why.push(careerType() === "player" ? T("Manager career only.") : T("Player career only."));
    if (usable(a) && !onNow) {
      var g = a.group && picked.find(function (o) { var b = byId(o); return b && b.group === a.group; });
      if (g) why.push(T("Replaces {addon} (only one per save).", { addon: T(byId(g).name) }));
      var miss = (a.requires || []).filter(function (r) { var b = byId(r); return picked.indexOf(r) < 0 && !(b && b.hidden); });
      if (miss.length) why.push(T("Also turns on: {list}.", { list: names(miss) }));
    } else if (onNow) {
      var deps = dependents(a.id, picked).filter(function (r) { var b = byId(r); return !(b && b.hidden); });
      if (deps.length) why.push(T("Also turns off: {list}.", { list: names(deps) }));
    }
    var tip = [T(a.description || ""), T("by {author}", { author: a.author }) + (a.version ? " · v" + a.version : "")].concat(why).filter(Boolean).join("\n");
    return '<button class="pre-diff hubplus-addon' + (onNow ? " on" : "") + '" data-action="' + (action || "hubplus-addon") + '" data-id="' + e2(a.id) + '" aria-pressed="' + onNow + '"' +
      (usable(a) ? "" : ' disabled style="opacity:.45;cursor:not-allowed"') + ' title="' + e2(tip) + '"><span class="pre-diff-k">' + e2(T(a.name)) +
      '</span><span class="pre-diff-v">' + e2(!fitsCareer(a) ? (careerType() === "player" ? T("Manager career only.") : T("Player career only.")).replace(/\.$/, "") : onNow ? T("On") : T("Off")) + (a.author ? " · " + e2(a.author) : "") + "</span></button>";
  }
  // turning one addon on or off in a list: what needs it goes with it; the new one wins its group and conflicts
  function toggle(picked, id) {
    var a = byId(id);
    if (!usable(a)) return picked;
    if (picked.indexOf(id) >= 0) {
      var drop = dependents(id, picked).concat([id]);
      return prune(picked.filter(function (x) { return drop.indexOf(x) < 0; }));
    }
    var keep = picked.filter(function (o) { var b = byId(o); return !(a.group && b && b.group === a.group) && (a.conflicts || []).indexOf(o) < 0 && (b.conflicts || []).indexOf(id) < 0; });
    picked.filter(function (o) { return keep.indexOf(o) < 0; }).forEach(function (g) { keep = keep.filter(function (x) { return dependents(g, picked).indexOf(x) < 0; }); });
    return prune(normalize([id].concat(keep)));
  }
  // addons from several developers (by author name): they were not made to work together
  function authorsOf(list) {
    var seen = {}, out = [];
    list.forEach(function (id) {
      var a = byId(id); if (!a) return;
      var k = String(a.author || "?").trim().toLowerCase();
      if (!seen[k]) { seen[k] = 1; out.push(String(a.author || "?").trim()); }
    });
    return out;
  }
  function mixWarning(list) {
    var au = authorsOf(list);
    if (au.length < 2) return "";
    return '<div class="hubplus-warn" style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(234,179,8,.15);border:1px solid rgba(234,179,8,.6);font-size:12px">&#9888; ' +
      e2(T("These addons come from different people ({authors}). Some of them may not work together or may crash the game.", { authors: au.join(", ") })) + "</div>";
  }
  function pickerHtml() {
    var v = view();
    if (!v) { ensureList(); return ""; }
    installLang();
    var list = all().filter(function (a) { return !a.hidden; });
    list = list.filter(fitsCareer).concat(list.filter(function (a) { return !fitsCareer(a); }));
    var head = '<div class="pre-field hubplus-pick"><span>' + e2(T("Addons for this save")) + "</span>";
    if (!list.length) {
      return head + '<div class="pre-note">' + e2(T("No addon installed. Put addon folders in {dir}, then restart RLC Hub Addon Manager.", { dir: v.dir || "addons" })) + "</div>" +
        '<div style="margin-top:6px"><button class="pre-diff" data-action="hubplus-folder" style="cursor:pointer"><span class="pre-diff-k">' + e2(T("Open the addons folder")) + "</span></button></div></div>";
    }
    var ct = careerType();
    if (!R.pick || R.career !== ct) { R.pick = prune(defaults()); R.career = ct; }
    R.pick = prune(normalize(R.pick));
    send(false);
    var picked = R.pick;
    var bad = (v.problems || []).map(function (p) { return e2(p.folder) + ": " + e2(p.error); });
    return head + '<div class="pre-note">' + e2(T("Pick them now: changing them once the career has started is possible from the Setup tab, but it can break the save.")) + "</div>" +
      '<div class="pre-series" role="group" style="flex-wrap:wrap;margin-top:6px">' + list.map(function (a) { return addonButton(a, picked); }).join("") + "</div>" +
      mixWarning(picked) +
      '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="pre-diff" data-action="hubplus-defaults" style="cursor:pointer"><span class="pre-diff-k">' + e2(T("Default addons")) + "</span></button>" +
      '<button class="pre-diff" data-action="hubplus-none" style="cursor:pointer"><span class="pre-diff-k">' + e2(T("No addons")) + "</span></button>" +
      '<button class="pre-diff" data-action="hubplus-folder" style="cursor:pointer"><span class="pre-diff-k">' + e2(T("Open the addons folder")) + "</span></button></div>" +
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

  /* Setup tab: change the addons of the loaded save (two confirmations) */
  var E = null; // { pick, step: 0 list / 1 first warning / 2 last warning, busy, key }
  function careerNow() { return typeof S !== "undefined" && S ? S.career : null; }
  function saveList() { var c = careerNow(); return c && c.hubPlus && Array.isArray(c.hubPlus.on) ? c.hubPlus.on : null; }
  function careerKey() { var c = careerNow(); return c ? [c.userTeamId, c.startDate, c.season].join("|") : ""; }
  function editHtml() {
    var cur = saveList() || [];
    var changed = E.pick.slice().sort().join(",") !== cur.slice().sort().join(",");
    var list = all().filter(function (a) { return !a.hidden; });
    list = list.filter(fitsCareer).concat(list.filter(function (a) { return !fitsCareer(a); }));
    var h = '<div class="hubplus-edit" style="margin-top:8px;padding:10px;border-radius:10px;border:1px solid rgba(127,127,127,.35)">' +
      '<div class="pre-series" role="group" style="flex-wrap:wrap">' + list.map(function (a) { return addonButton(a, E.pick, "hubplus-eaddon"); }).join("") + "</div>" + mixWarning(E.pick);
    if (E.step === 0) {
      h += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn primary sm" data-action="hubplus-edit-apply"' + (changed ? "" : " disabled") + ">" + e2(T("Apply")) + "</button>" +
        '<button class="btn sm" data-action="hubplus-edit-cancel">' + e2(T("Cancel")) + "</button></div>";
    } else {
      var first = E.step === 1;
      h += '<div style="margin-top:10px;padding:12px;border-radius:10px;background:#b91c1c;color:#fff;border:2px solid #fecaca">' +
        '<div style="font-weight:900;text-transform:uppercase;letter-spacing:.03em">&#9888; ' + e2(first ? T("Warning: this can break your save") : T("Last warning")) + "</div>" +
        '<div style="margin-top:6px">' + e2(first
          ? T("Changing the addons of a career that has started can corrupt the save. It could stay broken for up to one in-game year, or be lost forever.") + " " +
            T("Addons you turn off leave their data in the save; addons you turn on start from today, without what they would have done before.")
          : T("Are you sure? What happens to the save can not be undone. Make a copy of the save first if you care about it.")) + "</div>" +
        '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn sm" data-action="hubplus-edit-confirm" style="background:#fff;color:#b91c1c;font-weight:800"' + (E.busy ? " disabled" : "") + ">" +
        e2(first ? T("I understand, continue") : T("Yes, change the addons of this save")) + "</button>" +
        '<button class="btn sm" data-action="hubplus-edit-cancel">' + e2(T("Cancel")) + "</button></div></div>";
    }
    return h + "</div>";
  }

  document.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-action^="hubplus-"]') : null;
    if (el) {
      ev.preventDefault(); ev.stopPropagation();
      if (el.disabled) return;
      var act = el.dataset.action;
      if (act === "hubplus-folder") { if (window.hubPlus) window.hubPlus.openFolder(); return; }
      // --- new-career screen
      if (act === "hubplus-defaults" || act === "hubplus-none" || act === "hubplus-addon") {
        if (act === "hubplus-defaults") R.pick = prune(defaults());
        else if (act === "hubplus-none") R.pick = [];
        else R.pick = toggle((R.pick || defaults()).slice(), el.dataset.id);
        send(false); render();
        return;
      }
      // --- Setup tab: change the addons of this save
      if (act === "hubplus-edit-open") { E = { pick: (saveList() || []).slice(), step: 0, busy: false, key: careerKey() }; render(); return; }
      if (!E) return;
      if (act === "hubplus-edit-cancel") { E = null; render(); return; }
      if (act === "hubplus-eaddon") { if (E.step === 0) E.pick = toggle(E.pick.slice(), el.dataset.id); render(); return; }
      if (act === "hubplus-edit-apply") { E.step = 1; render(); return; }
      if (act === "hubplus-edit-confirm") {
        if (E.step === 1) { E.step = 2; render(); return; }
        if (E.busy || !window.hubPlus || !window.hubPlus.editSave) return;
        E.busy = true; render();
        window.hubPlus.editSave(E.pick).then(function (r) {
          if (!r || !r.ok) { E.busy = false; showToast((r && r.error) || T("Could not change the addons."), "error"); render(); return; }
          if (r.snapshot) S = r.snapshot;
          E = null;
          showToast(T("Addons of this save changed. Restart RLC Hub Addon Manager if something looks wrong."));
          render();
        }).catch(function (e) { E.busy = false; showToast(String(e && e.message || e), "error"); render(); });
      }
      return;
    }
    var go = ev.target && ev.target.closest ? ev.target.closest('[data-action="pre-start"]') : null;
    if (go && R.pick) send(true); // sent again right before the game's own "new career" call
  }, true);

  /* Setup tab: RLC Hub Addon Manager credit + addons of the loaded save */
  try {
    if (typeof doctorHtml === "function") {
      var origDoc = doctorHtml;
      doctorHtml = function () {
        var html = origDoc.apply(this, arguments);
        try {
          installLang();
          var onList = saveList();
          if (E && E.key !== careerKey()) E = null; // another save was loaded
          var box = "";
          if (onList) {
            var rows = onList.filter(function (id) { var a = byId(id); return !(a && a.hidden); }).map(function (id) {
              var a = byId(id);
              if (!a) return '<div style="opacity:.7">' + e2(id) + " (" + e2(T("not installed")) + ")</div>";
              var off = !fitsCareer(a) ? ' <span style="opacity:.7">(' + e2(careerType() === "player" ? T("Manager career only.") : T("Player career only.")) + " " + e2(T("Off in this save.")) + ")</span>" : "";
              return '<div style="margin-top:4px' + (off ? ";opacity:.55" : "") + '"><b>' + e2(T(a.name)) + "</b>" + (a.version ? " v" + e2(a.version) : "") + " · " + e2(T("by {author}", { author: a.author })) + off +
                (a.license ? ' <span style="opacity:.6">(' + e2(a.license) + ")</span>" : "") + "</div>";
            }).join("");
            box = '<div style="letter-spacing:.06em;text-transform:uppercase;opacity:.7">' + e2(T("Addons of this save")) + "</div>" +
              (rows || '<div style="opacity:.7">' + e2(T("No addons.")) + "</div>") + (E ? "" : mixWarning(onList)) +
              (E ? editHtml() : '<div style="margin-top:8px"><button class="btn sm" data-action="hubplus-edit-open">' + e2(T("Change the addons of this save")) + "</button></div>");
          }
          return html + '<div class="hubplus-setup" style="margin:18px 0 4px;font-size:12px">' + box +
            '<div style="margin-top:10px;text-align:center;letter-spacing:.06em;opacity:.6">' + e2(T("RLC Hub Addon Manager v{v} by Milan. All rights reserved. Addons belong to their authors.", { v: HUBPLUS_VERSION })) + "</div></div>";
        } catch (e) { console.error("[hub+] setup", e); return html; }
      };
    }
  } catch (e) { console.error("[hub+] setup hook", e); }
})();
