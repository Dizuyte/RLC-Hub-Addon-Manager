# RLC Hub Addon Manager

An addon manager for **RL Career Hub** (Rocket League career game), by Milan. Current version: **v1.1**, for
RL Career Hub **0.2.0-beta.34**.

- Runs in its own copy of the game (`Documents\RLC Hub Addon Manager`), with its own saves: the normal game is never touched.
- Addons are folders in `Documents\RLC Hub Addon Manager\addons`.
- The addons of a career are picked on the new-career screen; they can be changed later from the Setup tab after
  two warnings (it can break the save). A warning shows when the picked addons come from different authors.
- Comes with no addon. Every feature of RLC Enhancer is available as addons: **[RLCH-Addons-Milan](https://github.com/Dizuyte/RLCH-Addons-Milan)**.
- **Make your own: [docs/ADDONS.md](docs/ADDONS.md)** (French summary: [docs/ADDONS-FR.md](docs/ADDONS-FR.md)),
  starting from [examples/hello-world](examples/hello-world).

## Install (players)

Download `RLC-Hub-Addon-Manager-v1.1.zip` from the [releases](https://github.com/Dizuyte/RLC-Hub-Addon-Manager/releases), extract it, close RL Career Hub, double-click `Install RLC Hub Addon Manager.bat`, then start the game
with the **RLC Hub Addon Manager** shortcut. Full guide in the zip (`README (EN).txt`, `LISEZMOI (FR).txt`).

## How it works

| File | Goes to (inside `resources/app.asar` of the copy) |
|---|---|
| `src/core/core.js` | new file `rlc-hubplus/core.js`: finds the addons, gates what they wrap, actions, injects the UIs |
| `src/core/sandbox.js` | new file `rlc-hubplus/sandbox.js`: injected in the game window, gates the addons' UIs |
| `src/main-patch.js` | end of `main.js`: starts the addon manager, snapshot, IPC |
| `src/preload-patch.js` | end of `preload.js`: `window.hubPlus` (list, pick, call, open folder) |
| `src/renderer-patch.js` | end of `renderer/app.js`: picker on the new-career screen, addons of the save in Setup |

Gating: every game function an addon replaces (engine side or window side) is swapped for a dispatcher that runs the
addon's version only for saves that picked the addon. The original `app.asar` is kept as `app.asar.original`.

## Build

```
npm install esbuild
node installer/make-dist.js "out/RLC Hub Addon Manager v1.1"
```

## License

By Milan. **All rights reserved**, see `installer/static/LICENSE.txt`: the source can be read, not reused. Writing
and sharing addons that run inside RLC Hub Addon Manager is allowed; each addon belongs to its author. The game's own code is
not included.
