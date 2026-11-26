# Making an addon for RLC Hub Addon Manager

RLC Hub Addon Manager is an addon manager for **RL Career Hub** (0.2.0-beta.33). It runs in its own copy of the game
(`Documents\RL Career Hub+`). An addon is **one folder** in `Documents\RL Career Hub+\addons`. Players pick the
addons of a career when they create it. They can change them later from the Setup tab, after two warnings (it can
break the save), so your addon may be turned on in the middle of a career: handle saves that have no data of yours yet.

This guide is written so you can hand it to Claude (or read it yourself). A ready-to-copy prompt is at the end.

---

## 1. The 2-minute version

```
Documents\RL Career Hub+\addons\
  my-addon\
    addon.json     <- required: who you are, what to load
    main.js        <- optional: game logic (main process, Node.js)
    ui.js          <- optional: screens (game window, browser JavaScript)
```

1. Copy `Make an addon\examples\hello-world` into `addons\` and rename the folder.
2. Change `"id"` in `addon.json` (lowercase letters, digits and `-`, unique).
3. Restart RL Career Hub+, start a **new career**, turn your addon **On** above the Start button.
4. Problems are written to `addons\_hubplus.log`.

You never edit the game's files. You **wrap** game functions: keep the original, call it, add your part.
RLC Hub Addon Manager makes sure your code only runs in saves that picked your addon.

---

## 2. `addon.json`

```json
{
  "id": "my-addon",
  "name": "My addon",
  "author": "YourName",
  "version": "1.0.0",
  "description": "One sentence shown in the picker.",
  "game": "0.2.0-beta.33",
  "main": "main.js",
  "ui": ["ui.js"],
  "default": false,
  "requires": [],
  "conflicts": [],
  "group": null,
  "order": 100,
  "menu": false,
  "legacyKeys": [],
  "license": "MIT",
  "url": "https://github.com/you/my-addon",
  "lang": { "fr": { "My addon": "Mon addon" } }
}
```

| Field | Required | What it does |
|---|---|---|
| `id` | yes | Unique id, `a-z 0-9 -`, 2 to 48 characters. Stored in saves: **never change it** after release. |
| `name`, `author`, `version`, `description` | recommended | Shown in the picker and in the Setup tab. |
| `game` | recommended | Game version you tested. Another version only shows a warning. |
| `main` | no | File loaded in the main process (see 3). |
| `ui` | no | File or list of files run in the game window, in that order (see 4). |
| `default` | no | `true`: already On in the picker for new careers. |
| `requires` | no | Ids of addons yours needs. Picking yours turns them on; without them installed yours can't be picked. |
| `conflicts` | no | Ids that can't be in the same save as yours. |
| `group` | no | Only one addon per group in a save (for example two addons that both redo the socials: use the same group name). |
| `order` | no | Load order, small first (default 100). An addon loaded later wraps the ones before it. |
| `menu` | no | `true`: your UI also runs when no career is loaded (main menu, World editor). |
| `hidden` | no | `true`: a library addon, not shown in the picker. It is turned on by the addons that list it in `requires` (code shared by several addons). |
| `legacyKeys` | no | Keys in a save that mean "this save already used my addon" (only for saves made before RLC Hub Addon Manager). |
| `lang` | no | Your translations (see 6). |

Folders starting with `_` are ignored (handy to turn an addon off for everyone: rename it `_my-addon`).

---

## 3. `main.js`: game logic (main process)

```js
module.exports = function (hub) {
  const engine = hub.engine;              // the game's engine/league.js exports

  const advance = engine.advance;         // 1. keep the original
  engine.advance = function (state, rand, mode) {
    const result = advance.apply(this, arguments); // 2. call it
    hub.data(state).days = (hub.data(state).days || 0) + 1; // 3. your part
    return result;                        // 4. return what the game expects
  };
};
```

It runs **once**, when RL Career Hub+ starts. Everything you replace on `hub.engine` while it runs is
automatically limited to saves that have your addon.

### What `hub` gives you

| | |
|---|---|
| `hub.engine` | The game engine (`engine/league.js` exports). Wrap functions here. |
| `hub.events`, `hub.titles`, `hub.world` | Other game modules (`engine/events.js`, `engine/titles.js`, `engine/world.js`), or `null`. |
| `hub.module(/regex/)` | Any other loaded game module, found by its path. |
| `hub.wrap(target, fn)` | Wrap functions of another object than `hub.engine` (for example `hub.titles`): `hub.wrap(hub.titles, () => { hub.titles.best = ... })`. Same automatic limit to your saves. |
| `hub.data(state)` | Your own object inside the save, saved with it (`state.hubPlusData[<id>]`). Put **all** your data here. |
| `hub.state()` | The career loaded right now (or `null`). |
| `hub.save()` | Write the loaded career to disk. |
| `hub.isOn(state)` | Does this save have your addon? (Rarely needed: wrapped functions already check.) |
| `hub.action(name, fn)` | Something the game window can ask for (see 5). `fn(payload, state)` can be `async`. |
| `hub.onSnapshot(fn)` | Add your data to what the game window receives: `fn(snapshot, state)`, write into `snapshot.myAddon`. Only called for saves with your addon. |
| `hub.has(state, "other-id")` | Does this save have another addon? A library uses it to run each part only for the addons picked. |
| `hub.get(where, name)` | A top-level function or value of a game file, even one the game does not export. `where`: `"league"` (engine/league.js), `"titles"` (engine/titles.js) or `"main"` (main.js, for example `"state"`, `"saveName"`, `"playMatch"`). |
| `hub.replace(where, name, prev => newFn)` | Replace such a game function for the saves with your addon (the game's own calls inside that file use yours too). |
| `hub.set(where, name, value)` | Change a game value (not limited to your saves: use with care). |
| `hub.scope(where)` | For `with (hub.scope("league")) { ... }`: inside the block, the game file's own names work as if your code was written inside that file (handy to port code that was appended to a game file). Assigning a game function there replaces it for your saves. |
| `hub.hook(name, fn)` | Hooks RLC Hub Addon Manager puts inside game code. `"watch-check"`: `fn(stats)` returns `true`/`false` to accept or refuse a watched match with that many bots, `null` for the game's rule. |
| `hub.log(text)` | Line in `addons\_hubplus.log`. |
| `hub.dir`, `hub.manifest`, `hub.gameDir`, `hub.gameVersion`, `hub.electron` | Your folder, your addon.json, the game's app folder, the game version, Electron. |

### Rules

- **Always call the original** function and return its result (or something with the same shape).
- **State first**: game functions take the career (`state`) as their first argument. That is how RLC Hub Addon Manager knows
  which save is running. A function you add yourself (`engine.myThing = ...`) is not limited: only your code calls it.
- **Don't keep the career in a variable**: the player can load another save. Use the `state` you receive, or `hub.state()`.
- Wrapping `hub.engine.x` only changes calls that go **through the exports** (`engine.advance(...)`, which is what
  main.js and other addons use). To change calls the game makes inside `league.js` to its own functions, use
  `hub.replace("league", "x", ...)`.
- Wrap in `try/catch` when unsure: an error in your wrapper breaks the game for that save.
- Need files (JSON data, images)? Put them in your folder and read them with `require("fs")` and `hub.dir`.

---

## 4. `ui.js`: screens (game window)

Your UI files run in the game page, like the game's own `renderer/app.js`. You can use and replace the game's
global functions and variables.

```js
(function () {
  const orig = doctorHtml;                 // a game function that builds the Setup tab HTML
  doctorHtml = function () {
    const html = orig.apply(this, arguments);
    const days = (S && S.myAddon && S.myAddon.days) || 0;
    return html + "<div>" + esc(tl("Days: {n}", { n: days })) + "</div>";
  };
  document.addEventListener("click", (ev) => { /* your buttons */ });
})();
```

### What RLC Hub Addon Manager turns off for saves without your addon (automatically)

- game global functions you replaced (like `doctorHtml` above): the game's version is used;
- your `addEventListener`, `setInterval`, `setTimeout`, `requestAnimationFrame`, `MutationObserver`
  (also `ResizeObserver`, `IntersectionObserver`) callbacks: they don't run;
- `<style>` and `<link rel="stylesheet">` you add, elements you add **directly** to `<body>` or `<html>`,
  classes you add to `<body>`/`<html>` with `classList.add/toggle`: hidden or removed.

What it can't catch: changes to elements that already exist in the page (`el.style.x = ...`, `innerHTML` of a game
element outside a render function), and game globals declared with `let`/`const`. Prefer replacing the game's
`...Html()` functions: the game calls them on every render, so your changes come and go with the save.

### Useful game globals (seen in 0.2.0-beta.33, may change with the game)

- `S`: the last snapshot from the main process. `S.career` is the loaded career (or `null`), plus what your
  `hub.onSnapshot` added. `S.hubPlus.on` = addons of the loaded save.
- `render()`: redraws the screen. `tl(text, vars)`: translate a text (English = key), `{name}` filled from `vars`.
  `esc(text)`: escape HTML. `showToast(text, "error")`: small message.
- Screen builders other mods wrap: `homeHtml`, `seasonHtml`, `calendarBigHtml`, `standingsCardHtml`,
  `standWindowHtml`, `trainingHtml`, `transfersHtml`, `boardDetailHtml`, `postHtml`, `doctorHtml` (Setup tab),
  `preStartHtml` (new-career screen).
- `window.hub.*`: the game's own calls to the main process.
- `window.__hubPlusOn("my-addon")`: is my addon on right now?

The game's code is not documented: open the game's original files (`RL Career Hub\resources\app.asar.original`,
for example with `npx @electron/asar extract`) to find the functions you need. Read them, don't share them: the
game's code belongs to its authors.

---

## 5. Talking to the main process: actions

`main.js`:

```js
hub.action("reset", (payload, state) => {
  hub.data(state).days = 0;
  return { done: true };          // return { save: false, ... } if you only read
});
```

`ui.js`:

```js
const res = await hubPlus.call("my-addon", "reset", { any: "json" });
if (res.ok) { if (res.snapshot) S = res.snapshot; render(); }
else showToast(res.error, "error");
```

`res` is `{ ok, result, snapshot, error }`. The career is saved after the action and `snapshot` is the fresh one.
If your action only reads (returns `{ save: false, ... }`), nothing is saved and `snapshot` is `null`: faster.
Actions are refused for saves without your addon.

---

## 6. Texts and translations

Write every text in **English** and pass it through `tl()` (UI) so the game's language system can translate it.
Your translations go in `addon.json`:

```json
"lang": { "fr": { "Days: {n}": "Jours : {n}", "My addon": "Mon addon" } }
```

`name` and `description` are translated the same way. Translating is up to you: missing texts stay in English.

---

## 7. How saves work

- New career: the picked list is stored in the save (`state.hubPlus.on`).
- Setup tab > "Change the addons of this save": the player can turn addons on or off in a running career, after two
  warnings. An addon turned on later starts from that day (its `generateLeague` part never ran for that save); an addon
  turned off leaves its data in the save. Every change is kept in `state.hubPlus.edits`.
- When the addons picked come from different authors, the player sees a warning that they may not work together.
- Saves imported from the normal game: no addon (except addons whose `legacyKeys` are found in the save).
- An addon removed from the folder: its saves still open, its data stays in the save, its features are gone
  until it comes back.
- Updating your addon: keep the `id`, and make your code accept older data (check what's in `hub.data(state)`).

---

## 8. Sharing

Zip your addon folder. Players unzip it into `Documents\RL Career Hub+\addons` and restart RL Career Hub+.
Choose a license for your addon (put a `LICENSE` file in it): your addon is yours, not part of RLC Hub Addon Manager.
Porting someone else's mod into an addon: get their permission and credit them.

---

## 9. When something goes wrong

- `addons\_hubplus.log`: addons found, problems in `addon.json`, errors in `main.js`, errors in your UI.
- Your addon is greyed out in the picker: hover it, the reason is shown (missing addon, load error).
- To test a fix: restart RL Career Hub+ (UI files are read at start) and load a save that has your addon.

---

## 10. Prompt for Claude

Copy this, then describe your addon:

> I'm making an addon for RLC Hub Addon Manager, an addon manager for the game RL Career Hub (Electron, version 0.2.0-beta.33).
> Follow the attached guide ADDONS.md exactly: one folder with addon.json, main.js (module.exports = function (hub)
> {...}, wrap hub.engine functions, keep the original and call it, store data only in hub.data(state)) and ui.js
> (runs in the game page, replace game global functions like doctorHtml and call the original, texts in English
> through tl(), translations in addon.json "lang", talk to main.js with hubPlus.call and hub.action).
> Never edit the game's files. Start from the hello-world example. Here is what my addon should do: ...
