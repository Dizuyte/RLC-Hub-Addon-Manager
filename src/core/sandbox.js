/* RLC Hub+ (c) 2026 Milan. All rights reserved. See LICENSE.txt.
   Addon manager, game window.
   Every addon UI runs between __hubPlusUI.begin(id) and __hubPlusUI.end(id). While it runs (and later, whenever code of that
   addon runs again), what it hooks is tagged with its id:
   - global functions of the game it replaces (standingsCardHtml = ...): a dispatcher calls the addon's version only
     when the save has the addon
   - event listeners, timers, observers: their callbacks only run when the save has the addon
   - <style>/<link> it adds, nodes it puts straight in <body>, classes it puts on <html>/<body>: hidden when the save
     does not have the addon
   Which addons are on: the loaded save's list (S.career.hubPlus), the list being picked on the new-career screen,
   or, with no save loaded, the addons marked "menu" in their addon.json. */
(function () {
  "use strict";
  if (window.__hubPlusUI) return;
  var cur = null;               // addon whose code is running right now
  var snap = null;              // window functions before the running addon's script
  var tagged = [];              // { node, id, kind, prev }
  var classes = {};             // id -> [class names on html/body]
  var wraps = new WeakMap();    // listener -> { id: wrapped }
  var setKey = "", setNow = new Set();

  function gameS() { try { return typeof S !== "undefined" ? S : null; } catch (e) { return null; } }
  function activeList() {
    if (typeof window.__hubPlusActiveList === "function") { try { return window.__hubPlusActiveList(); } catch (e) {} }
    var s = gameS();
    var meta = s && s.hubPlus;
    if (window.__hubPlusCreating && document.querySelector(".pre-go") && Array.isArray(window.__hubPlusPending)) return window.__hubPlusPending;
    var c = s && s.career;
    if (c && c.hubPlus && Array.isArray(c.hubPlus.on)) return c.hubPlus.on;
    if (c && meta && Array.isArray(meta.on)) return meta.on;
    if (c) return [];
    if (meta && Array.isArray(meta.pending)) return meta.pending;
    var out = [];
    if (meta && meta.list && Array.isArray(meta.list.addons)) meta.list.addons.forEach(function (a) { if (a.menu) out.push(a.id); });
    return out;
  }
  function active() {
    var l = activeList(), k = l.join(",");
    if (k !== setKey) { setKey = k; setNow = new Set(l); setTimeout(sync, 0); }
    return setNow;
  }
  function on(id) { return id == null || active().has(id); }

  function run(id, fn, self, args) {
    var p = cur; cur = id;
    try { return fn.apply(self, args); }
    catch (e) { console.error("[hub+] error in addon " + id + ": " + (e && e.stack || e)); throw e; }
    finally { cur = p; }
  }
  // mode "skip": the call is dropped while the addon is off; "defer": tried again a bit later (keeps polling loops alive)
  function wrapCb(cb, id, mode, delay) {
    if (typeof cb !== "function" || cb.__hubPlusFor) return cb;
    var w = function () {
      if (on(id)) return run(id, cb, this, arguments);
      if (mode === "defer") { var a = arguments; origST(function () { w.apply(null, a); }, Math.max(500, delay || 0)); }
    };
    w.__hubPlusFor = id;
    return w;
  }

  /* --- listeners --- */
  var ET = EventTarget.prototype, origAdd = ET.addEventListener, origRem = ET.removeEventListener;
  ET.addEventListener = function (type, l, opt) {
    if (cur && l) {
      var m = wraps.get(l); if (!m) { m = {}; wraps.set(l, m); }
      if (!m[cur]) {
        var id = cur;
        m[cur] = function (ev) {
          if (!on(id)) return;
          return run(id, typeof l === "function" ? l : function (e) { return l.handleEvent(e); }, this, [ev]);
        };
      }
      return origAdd.call(this, type, m[cur], opt);
    }
    return origAdd.call(this, type, l, opt);
  };
  ET.removeEventListener = function (type, l, opt) {
    var m = l && wraps.get(l);
    if (m) for (var k in m) origRem.call(this, type, m[k], opt);
    return origRem.call(this, type, l, opt);
  };

  /* --- timers and observers --- */
  var origST = window.setTimeout.bind(window), origSI = window.setInterval.bind(window), origRAF = window.requestAnimationFrame && window.requestAnimationFrame.bind(window);
  window.setTimeout = function (cb, d) {
    var a = Array.prototype.slice.call(arguments);
    if (cur) a[0] = wrapCb(cb, cur, "defer", d);
    return origST.apply(null, a);
  };
  window.setInterval = function (cb, d) {
    var a = Array.prototype.slice.call(arguments);
    if (cur) a[0] = wrapCb(cb, cur, "skip");
    return origSI.apply(null, a);
  };
  if (origRAF) window.requestAnimationFrame = function (cb) { return origRAF(cur ? wrapCb(cb, cur, "defer", 250) : cb); };
  ["MutationObserver", "ResizeObserver", "IntersectionObserver"].forEach(function (name) {
    var Orig = window[name];
    if (typeof Orig !== "function") return;
    var Gated = function (cb, o) { return new Orig(cur ? wrapCb(cb, cur, "skip") : cb, o); };
    Gated.prototype = Orig.prototype;
    window[name] = Gated;
  });

  /* --- styles, top-level nodes, classes --- */
  function tag(node, kind) {
    if (!cur || !node || node.nodeType !== 1 || node.__hubPlusAddon) return;
    node.__hubPlusAddon = cur;
    tagged.push({ node: node, id: cur, kind: kind, prev: null });
  }
  function watchInsert(node, parent) {
    if (!cur || !node || node.nodeType !== 1) return;
    var t = node.tagName;
    if (t === "STYLE" || (t === "LINK" && /stylesheet/i.test(node.rel || ""))) tag(node, "style");
    else if (parent === document.body || parent === document.documentElement) tag(node, "top");
  }
  var NP = Node.prototype, origAppend = NP.appendChild, origInsert = NP.insertBefore;
  NP.appendChild = function (n) { watchInsert(n, this); return origAppend.apply(this, arguments); };
  NP.insertBefore = function (n) { watchInsert(n, this); return origInsert.apply(this, arguments); };
  ["append", "prepend"].forEach(function (m) {
    var o = Element.prototype[m];
    if (typeof o !== "function") return;
    Element.prototype[m] = function () { for (var i = 0; i < arguments.length; i++) watchInsert(arguments[i], this); return o.apply(this, arguments); };
  });
  var TL = DOMTokenList.prototype, origCAdd = TL.add, origToggle = TL.toggle;
  function rootList(l) { return (document.body && l === document.body.classList) || l === document.documentElement.classList; }
  function noteClass(l, names) {
    if (!cur || !rootList(l)) return;
    var arr = classes[cur] || (classes[cur] = []);
    for (var i = 0; i < names.length; i++) if (arr.indexOf(names[i]) < 0) arr.push(names[i]);
  }
  TL.add = function () { noteClass(this, arguments); return origCAdd.apply(this, arguments); };
  TL.toggle = function (n, force) { if (force !== false) noteClass(this, [n]); return origToggle.apply(this, arguments); };

  function sync() {
    var set = active();
    tagged = tagged.filter(function (t) { return t.node.isConnected || t.kind === "style"; });
    tagged.forEach(function (t) {
      var yes = set.has(t.id);
      if (t.kind === "style") {
        if (yes && t.node.media === "not all") t.node.media = t.prev || "";
        else if (!yes && t.node.media !== "not all") { t.prev = t.node.media || ""; t.node.media = "not all"; }
      } else if (t.kind === "top") {
        if (yes && t.node.dataset.hubPlusHidden) { t.node.style.display = t.prev || ""; delete t.node.dataset.hubPlusHidden; }
        else if (!yes && !t.node.dataset.hubPlusHidden) { t.prev = t.node.style.display; t.node.style.display = "none"; t.node.dataset.hubPlusHidden = "1"; }
      }
    });
    Object.keys(classes).forEach(function (id) {
      var yes = set.has(id);
      [document.documentElement, document.body].forEach(function (el) {
        if (!el) return;
        classes[id].forEach(function (c) {
          var k = "hubPlusHad_" + c.replace(/[^a-zA-Z0-9]/g, "_");
          if (!yes && el.classList.contains(c)) { el.dataset[k] = "1"; el.classList.remove(c); }
          else if (yes && el.dataset[k]) { delete el.dataset[k]; origCAdd.call(el.classList, c); }
        });
      });
    });
  }

  /* --- global functions --- */
  function fnSnapshot() {
    var m = new Map();
    Object.getOwnPropertyNames(window).forEach(function (k) {
      var d; try { d = Object.getOwnPropertyDescriptor(window, k); } catch (e) { return; }
      if (d && "value" in d && typeof d.value === "function") m.set(k, d.value);
    });
    return m;
  }
  function begin(id) { if (cur) end(null); cur = id; snap = fnSnapshot(); }
  function end(id) {
    if (!cur || (id != null && id !== cur)) return; // end(null) = safety close after a script that threw
    var aid = cur, before = snap;
    cur = null; snap = null;
    if (!before) return;
    fnSnapshot().forEach(function (now, k) {
      var prev = before.get(k);
      if (typeof prev !== "function" || prev === now) return;
      var g = function () { return on(aid) ? run(aid, now, this, arguments) : prev.apply(this, arguments); };
      g.__hubPlusAddon = aid;
      try { window[k] = g; } catch (e) {}
    });
    sync();
  }

  window.__hubPlusUI = { begin: begin, end: end, sync: sync, on: on, active: function () { return Array.from(active()); } };
  window.__hubPlusOn = on;
  origSI(function () { active(); }, 700);
})();
