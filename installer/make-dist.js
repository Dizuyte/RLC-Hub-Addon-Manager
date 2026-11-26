// RLC Hub Addon Manager (c) 2026 Milan. All rights reserved. See LICENSE.txt.
// Builds the shareable RLC Hub Addon Manager package: payload.bin (minified, encoded code) + installer + addon kit (guide + example).
// usage: node installer/make-dist.js [output folder]   (needs: npm install esbuild)
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
let esbuild;
try { esbuild = require("esbuild"); } catch (_e) { esbuild = require("/opt/npm-tools/node_modules/esbuild"); }

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "dist", "RLC Hub Addon Manager"));
const VERSION = "1.0";
const GAME = "0.2.0-beta.33";
const KEY = Buffer.from("rlc-hubplus/milan/2026/all-rights-reserved");
const BANNER =
  "/* RLC Hub Addon Manager v" + VERSION + " (c) 2026 Milan. All rights reserved.\n" +
  "   Copying, redistributing, modifying or reusing this code, in whole or in part, including in RL Career Hub\n" +
  "   itself or any other project, is prohibited without the author's written permission.\n" +
  "   Writing addons that run inside RLC Hub Addon Manager is allowed: see LICENSE.txt. */\n";

const WATCH = "_0x3b0050['bots']===0x6&&_0x3b0050['cars']===0x6&&_0x3b0050[_0x36788b(0x438)]===0x3&&_0x3b0050['orangeCars']===0x3";
const min = (file) =>
  esbuild.transformSync(fs.readFileSync(path.join(SRC, file), "utf8"), { minify: true, legalComments: "none", charset: "utf8" }).code;
const chunk = (...files) => "\n;" + BANNER + files.map(min).join("\n;");

const payload = {
  mod: VERSION,
  game: GAME,
  ops: [
    { file: "rlc-hubplus/core.js", create: BANNER + min("core/core.js") },
    // the sandbox is injected into the game window as text: kept readable for addon makers who debug in DevTools
    { file: "rlc-hubplus/sandbox.js", create: BANNER + fs.readFileSync(path.join(SRC, "core", "sandbox.js"), "utf8") },
    // hook "watch-check": the game's rule for a watched match (6 bots, 3 per side) can be changed by addons
    { file: "main.js", replace: { from: WATCH, to: "(typeof __hubWatchOk==='function'&&__hubWatchOk(_0x3b0050)!==null?__hubWatchOk(_0x3b0050):(" + WATCH + "))" } },
    { file: "engine/league.js", append: chunk("bridge-patch.js") },
    { file: "engine/titles.js", append: chunk("bridge-patch.js") },
    { file: "main.js", append: chunk("main-patch.js") },
    { file: "preload.js", append: chunk("preload-patch.js") },
    { file: "renderer/app.js", append: chunk("renderer-patch.js") },
  ],
};

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "files"), { recursive: true });
const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 9 });
for (let i = 0; i < gz.length; i++) gz[i] ^= KEY[i % KEY.length];
fs.writeFileSync(path.join(OUT, "files", "payload.bin"), gz);
const inst = esbuild.transformSync(fs.readFileSync(path.join(__dirname, "install.js"), "utf8"), { minify: true, legalComments: "none" }).code;
fs.writeFileSync(path.join(OUT, "files", "install.js"), "/* RLC Hub Addon Manager installer (c) 2026 Milan. All rights reserved. */\n" + inst);
for (const f of fs.readdirSync(path.join(__dirname, "static"))) {
  const dest = f === "LICENSE.txt" ? [path.join(OUT, f), path.join(OUT, "files", f)] : [path.join(OUT, f)];
  for (const d of dest) fs.copyFileSync(path.join(__dirname, "static", f), d);
}
// addon kit: installed as "<RLC Hub Addon Manager folder>\Make an addon"
const KIT = path.join(OUT, "files", "addon-kit");
fs.mkdirSync(KIT, { recursive: true });
fs.copyFileSync(path.join(ROOT, "docs", "ADDONS.md"), path.join(KIT, "ADDONS.md"));
fs.copyFileSync(path.join(ROOT, "docs", "ADDONS-FR.md"), path.join(KIT, "LISEZMOI ADDONS (FR).md"));
copyDir(path.join(ROOT, "examples"), path.join(KIT, "examples"));
console.log("payload", gz.length, "bytes ->", OUT);
