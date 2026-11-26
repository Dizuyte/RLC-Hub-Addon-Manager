// Hello world - game window part. Runs in the game page, like the game's own renderer/app.js:
// the game's globals (S, render, tl, esc, showToast, doctorHtml ...) can be used and replaced.
// RLC Hub+ turns everything here off for saves that did not pick this addon.
(function () {
  "use strict";

  // 1. Replace a game screen function: call the original, add your HTML.
  const origDoctor = doctorHtml; // the Setup tab
  doctorHtml = function () {
    const html = origDoctor.apply(this, arguments);
    const days = (S && S.helloWorld && S.helloWorld.days) || 0;
    return html +
      '<div class="panel" style="margin-top:12px;padding:12px">' +
      esc(tl("Hello world addon: {n} days played in this save.", { n: days })) +
      ' <button class="btn" data-action="hello-reset">' + esc(tl("Reset")) + "</button></div>";
  };

  // 2. React to clicks on your own buttons.
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest && ev.target.closest('[data-action="hello-reset"]');
    if (!btn) return;
    ev.preventDefault();
    const res = await hubPlus.call("hello-world", "reset");
    if (res.ok) {
      if (res.snapshot) S = res.snapshot; // fresh data from the main process
      render();
      showToast(tl("Counter reset."));
    } else {
      showToast(res.error, "error");
    }
  });
})();
