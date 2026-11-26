# RLC Hub+

An addon manager for **RL Career Hub** (Rocket League career game), by Milan. Current version: **v1.0**, for
RL Career Hub **0.2.0-beta.33**.

- Runs in its own copy of the game (`Documents\RL Career Hub+`), with its own saves: the normal game is never touched.
- Addons are folders in `Documents\RL Career Hub+\addons`.
- The addons of a career are picked on the new-career screen and **locked** for that save.
- Comes with no addon. **Make your own: [docs/ADDONS.md](docs/ADDONS.md)** (French summary: [docs/ADDONS-FR.md](docs/ADDONS-FR.md)),
  starting from [examples/hello-world](examples/hello-world).

## Install (players)

Download the release zip, extract it, close RL Career Hub, double-click `Install RLC Hub+.bat`, then start the game
with the **RL Career Hub+** shortcut. Full guide in the zip (`README (EN).txt`, `LISEZMOI (FR).txt`).

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
node installer/make-dist.js "out/RLC Hub+ v1.0"
```

## License

By Milan. **All rights reserved**, see `installer/static/LICENSE.txt`: the source can be read, not reused. Writing
and sharing addons that run inside RLC Hub+ is allowed; each addon belongs to its author. The game's own code is
not included.
