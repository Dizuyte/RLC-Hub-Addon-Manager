/* RLC Hub Addon Manager installer. (c) 2026 Milan. All rights reserved. */
"use strict";
process.noAsar = true;
let fs;
try { fs = require("original-fs"); } catch (_e) { fs = require("fs"); }
const path = require("path");
const zlib = require("zlib");
const os = require("os");
const crypto = require("crypto");
const cp = require("child_process");

const KEY = Buffer.from("rlc-hubplus/milan/2026/all-rights-reserved");
const MARKS = ["RLC Hub Addon Manager", "RLC Hub+", "RLC Enhancer", "RLC " + "Mod"]; // game files already changed by RLC Hub Addon Manager or RLC Enhancer

function say(en, fr) { console.log(en); if (fr) console.log("  " + fr); }
function fail(en, fr) {
  console.log("");
  console.log("ERROR: " + en);
  if (fr) console.log("ERREUR : " + fr);
  process.exit(1);
}

/* ---------- payload ---------- */
function loadPayload(file) {
  const raw = fs.readFileSync(file);
  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw[i] ^ KEY[i % KEY.length];
  return JSON.parse(zlib.gunzipSync(out).toString("utf8"));
}

/* ---------- asar ---------- */
function readAsar(file) {
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const headerPickle = head.readUInt32LE(4);
    const strLen = head.readUInt32LE(12);
    const hb = Buffer.alloc(strLen);
    fs.readSync(fd, hb, 0, strLen, 16);
    return { file, header: JSON.parse(hb.toString("utf8")), base: 8 + headerPickle };
  } finally { fs.closeSync(fd); }
}
function nodeAt(asar, rel) {
  let n = asar.header;
  for (const part of rel.split("/")) {
    if (!n.files || !n.files[part]) return null;
    n = n.files[part];
  }
  return n;
}
function readEntry(asar, rel) {
  const n = nodeAt(asar, rel);
  if (!n || n.files || n.unpacked) return null;
  const buf = Buffer.alloc(n.size);
  const fd = fs.openSync(asar.file, "r");
  try { fs.readSync(fd, buf, 0, n.size, asar.base + Number(n.offset)); } finally { fs.closeSync(fd); }
  return buf;
}
function gameVersion(asar) {
  try { return JSON.parse(readEntry(asar, "package.json").toString("utf8")).version || "?"; } catch (_e) { return "?"; }
}
function isModded(asar) {
  const m = readEntry(asar, "main.js");
  const txt = !!m && m.toString("utf8");
  return !!txt && MARKS.some((k) => txt.indexOf(k) >= 0);
}
function integrityOf(buf) {
  const blockSize = 4 * 1024 * 1024, blocks = [];
  for (let i = 0; i < buf.length; i += blockSize) blocks.push(crypto.createHash("sha256").update(buf.subarray(i, i + blockSize)).digest("hex"));
  if (!blocks.length) blocks.push(crypto.createHash("sha256").update(Buffer.alloc(0)).digest("hex"));
  return { algorithm: "SHA256", hash: crypto.createHash("sha256").update(buf).digest("hex"), blockSize, blocks };
}

/* apply the payload operations in memory; returns Map rel -> Buffer, or throws */
function planChanges(asar, payload) {
  const changed = new Map();
  const get = (rel) => {
    if (changed.has(rel)) return changed.get(rel).toString("utf8");
    const b = readEntry(asar, rel);
    if (!b) throw new Error("missing file " + rel);
    return b.toString("utf8");
  };
  for (const op of payload.ops) {
    if (op.create !== undefined) { changed.set(op.file, Buffer.from(op.create, "utf8")); continue; }
    let s = get(op.file);
    if (op.replace) {
      const n = s.split(op.replace.from).length - 1;
      if (n !== 1) throw new Error("anchor not found in " + op.file);
      s = s.replace(op.replace.from, () => op.replace.to);
    }
    if (op.replaceRe) {
      const re = new RegExp(op.replaceRe.re, "g");
      const n = (s.match(re) || []).length;
      if (n !== 1) throw new Error("anchor not found in " + op.file);
      s = s.replace(re, op.replaceRe.to);
    }
    if (op.insertAfter) {
      const i = s.indexOf(op.insertAfter.anchor);
      if (i < 0) throw new Error("anchor not found in " + op.file);
      const j = i + op.insertAfter.anchor.length;
      const text = s.indexOf("\r\n") >= 0 ? op.insertAfter.text.replace(/\r?\n/g, "\r\n") : op.insertAfter.text;
      s = s.slice(0, j) + text + s.slice(j);
    }
    if (op.append !== undefined) s = s + op.append;
    changed.set(op.file, Buffer.from(s, "utf8"));
  }
  return changed;
}

function writeAsar(asar, changed, outFile) {
  const header = JSON.parse(JSON.stringify(asar.header));
  // add created files to the header
  for (const rel of changed.keys()) {
    const parts = rel.split("/");
    let n = header;
    for (let i = 0; i < parts.length - 1; i++) { n.files[parts[i]] = n.files[parts[i]] || { files: {} }; n = n.files[parts[i]]; }
    const leaf = parts[parts.length - 1];
    if (!n.files[leaf]) n.files[leaf] = { size: 0, offset: "0" };
  }
  const plan = []; let offset = 0;
  (function walk(n, pre) {
    for (const name of Object.keys(n.files)) {
      const e = n.files[name], rel = pre ? pre + "/" + name : name;
      if (e.files) { walk(e, rel); continue; }
      if (e.unpacked || e.link) continue;
      if (changed.has(rel)) {
        const buf = changed.get(rel);
        plan.push({ buf });
        e.size = buf.length;
        e.integrity = integrityOf(buf);
      } else {
        plan.push({ from: asar.base + Number(e.offset), size: e.size });
      }
      e.offset = String(offset);
      offset += e.size;
    }
  })(header, "");
  const json = Buffer.from(JSON.stringify(header), "utf8");
  const pad = (4 - (json.length % 4)) % 4;
  const payload = Buffer.alloc(8 + json.length + pad);
  payload.writeUInt32LE(4 + json.length + pad, 0);
  payload.writeUInt32LE(json.length, 4);
  json.copy(payload, 8);
  const size = Buffer.alloc(8);
  size.writeUInt32LE(4, 0);
  size.writeUInt32LE(payload.length, 4);
  const tmp = outFile + ".tmp";
  const out = fs.openSync(tmp, "w");
  const inp = fs.openSync(asar.file, "r");
  try {
    fs.writeSync(out, size); fs.writeSync(out, payload);
    const chunk = Buffer.alloc(8 * 1024 * 1024);
    for (const p of plan) {
      if (p.buf) { fs.writeSync(out, p.buf); continue; }
      let left = p.size, pos = p.from;
      while (left > 0) {
        const n = fs.readSync(inp, chunk, 0, Math.min(chunk.length, left), pos);
        if (n <= 0) throw new Error("read error");
        fs.writeSync(out, chunk, 0, n); left -= n; pos += n;
      }
    }
  } finally { fs.closeSync(out); fs.closeSync(inp); }
  fs.renameSync(tmp, outFile);
}

/* ---------- copy with progress ---------- */
function listTree(dir, skip, acc, rel) {
  acc = acc || []; rel = rel || "";
  for (const ent of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? path.join(rel, ent.name) : ent.name;
    if (skip(r, ent)) continue;
    if (ent.isDirectory()) listTree(dir, skip, acc, r);
    else if (ent.isFile()) acc.push({ rel: r, size: fs.statSync(path.join(dir, r)).size });
  }
  return acc;
}
function copyTree(src, dst, skip, label) {
  const files = listTree(src, skip);
  const total = files.reduce((a, f) => a + f.size, 0) || 1;
  let done = 0, shown = -1;
  for (const f of files) {
    const to = path.join(dst, f.rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, f.rel), to);
    done += f.size;
    const pct = Math.floor((done / total) * 20) * 5;
    if (pct !== shown) { shown = pct; process.stdout.write("\r  " + label + " " + pct + "%   "); }
  }
  process.stdout.write("\n");
}

/* ---------- windows helpers ---------- */
function psFolder(name, fallback) {
  try {
    const r = cp.execFileSync("powershell.exe", ["-NoProfile", "-Command", "[Environment]::GetFolderPath('" + name + "')"], { encoding: "utf8" }).trim();
    if (r && fs.existsSync(r)) return r;
  } catch (_e) {}
  return fallback;
}
function q(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }
function makeShortcut(lnk, exe, args, workdir) {
  const script =
    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut(" + q(lnk) + ");" +
    "$s.TargetPath=" + q(exe) + ";$s.Arguments=" + q(args) + ";$s.WorkingDirectory=" + q(workdir) + ";" +
    "$s.IconLocation=" + q(exe + ",0") + ";$s.Description='RLC Hub Addon Manager';$s.Save()";
  cp.execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { stdio: "ignore" });
}

/* ---------- main ---------- */
function patchFile(srcAsarFile, outFile, payload) {
  const asar = readAsar(srcAsarFile);
  writeAsar(asar, planChanges(asar, payload), outFile);
}

function main() {
  const args = process.argv.slice(2);
  const here = __dirname;
  const payload = loadPayload(path.join(here, "payload.bin"));

  if (args[0] === "--patch-only") { patchFile(args[1], args[2], payload); console.log("patched"); return; }

  const gameDir = args[0];
  const importSaves = String(args[1] || "Y").toUpperCase() === "Y";
  say("", "");
  say("RLC Hub Addon Manager v" + payload.mod + " by Milan. All rights reserved.", "RLC Hub Addon Manager v" + payload.mod + " par Milan. Tous droits reserves.");
  say("", "");

  const srcExe = path.join(gameDir, "RL Career Hub.exe");
  const srcAsarFile = path.join(gameDir, "resources", "app.asar");
  if (!fs.existsSync(srcExe) || !fs.existsSync(srcAsarFile)) fail("RL Career Hub was not found in " + gameDir, "RL Career Hub est introuvable dans " + gameDir);

  const docs = psFolder("MyDocuments", path.join(os.homedir(), "Documents"));
  const root = path.join(docs, "RLC Hub Addon Manager");
  const game = path.join(root, "RL Career Hub");
  const data = path.join(root, "rl-career-hub (AppData)");
  const exe = path.join(game, "RL Career Hub.exe");
  const asarFile = path.join(game, "resources", "app.asar");
  const backup = path.join(game, "resources", "app.asar.original");

  // 1. pick the clean game files to patch
  const src = readAsar(srcAsarFile);
  const srcVersion = gameVersion(src);
  let base = null;
  if (fs.existsSync(backup)) {
    const b = readAsar(backup);
    if (gameVersion(b) === srcVersion || isModded(src)) base = b;
  }
  if (!base) {
    if (isModded(src)) fail("Your RL Career Hub install is already modified. Reinstall the game from Nixus, then run this again.", "Ton RL Career Hub est deja modifie. Reinstalle le jeu de Nixus puis relance l'installation.");
    base = src;
  }
  const baseVersion = gameVersion(base);
  try { planChanges(base, payload); } catch (_e) {
    if (baseVersion === payload.game) fail("Your RL Career Hub files are different from the official " + baseVersion + ". Reinstall the game from Nixus, then try again.",
      "Tes fichiers RL Career Hub sont differents de la version officielle " + baseVersion + ". Reinstalle le jeu de Nixus puis reessaie.");
    fail("RLC Hub Addon Manager works with RL Career Hub " + payload.game + ", you have " + baseVersion + ". Wait for an RLC Hub Addon Manager update.",
      "RLC Hub Addon Manager marche avec RL Career Hub " + payload.game + ", tu as la " + baseVersion + ". Attends une mise a jour de RLC Hub Addon Manager.");
  }

  // 2. copy the game (first install or new game version)
  const needCopy = !fs.existsSync(exe) || base === src;
  if (needCopy) {
    say("Copying the game to " + game + " ...", "Copie du jeu dans " + game + " ...");
    const skip = (r) => {
      const n = r.replace(/\\/g, "/").toLowerCase();
      return n === "resources/app" || n.startsWith("resources/app/") || n === "resources/app.asar" ||
        n === "resources/app.asar.original" || n.startsWith("uninstall ");
    };
    try { copyTree(gameDir, game, skip, "game / jeu"); } catch (e) {
      fail("Copy failed (" + e.code + "). Close RL Career Hub and try again.", "La copie a echoue (" + e.code + "). Ferme RL Career Hub et reessaie.");
    }
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(srcAsarFile, backup);
    base = readAsar(backup);
  }
  // an old unpacked "app" folder would be loaded instead of app.asar
  const stale = path.join(game, "resources", "app");
  if (fs.existsSync(stale)) { try { fs.renameSync(stale, stale + ".disabled-" + Date.now()); } catch (_e) {} }

  // 3. patch
  say("Installing RLC Hub Addon Manager ...", "Installation de RLC Hub Addon Manager ...");
  try { writeAsar(base, planChanges(base, payload), asarFile); } catch (e) {
    fail("Could not write the game files (" + (e.code || e.message) + "). Close RLC Hub Addon Manager and try again.",
      "Impossible d'ecrire les fichiers du jeu (" + (e.code || e.message) + "). Ferme RLC Hub Addon Manager et reessaie.");
  }

  // 4. saves
  if (!fs.existsSync(data)) {
    const appData = process.env.APPDATA ? path.join(process.env.APPDATA, "rl-career-hub") : null;
    if (importSaves && appData && fs.existsSync(appData)) {
      say("Copying your saves and settings ...", "Copie de tes saves et reglages ...");
      const junk = new Set(["cache", "code cache", "gpucache", "dawngraphitecache", "dawnwebgpucache", "blob_storage", "shared dictionary", "lockfile", "network", "crashpad"]);
      const skip = (r) => {
        const n = r.replace(/\\/g, "/").toLowerCase();
        return junk.has(n.split("/")[0]) || /\.log$/.test(n) || n.startsWith("sharedstorage");
      };
      try { copyTree(appData, data, skip, "saves"); } catch (e) {
        say("Some files could not be copied (" + e.code + "). Close RL Career Hub and run the installer again to retry.",
          "Certains fichiers n'ont pas ete copies (" + e.code + "). Ferme RL Career Hub et relance l'installation pour reessayer.");
      }
    } else {
      fs.mkdirSync(data, { recursive: true });
    }
  } else {
    say("Keeping your existing RLC Hub Addon Manager saves.", "Tes saves RLC Hub Addon Manager sont conservees.");
  }

  // 4b. addons folder (an update never touches it), guide and example
  const addonsDir = path.join(root, "addons");
  fs.mkdirSync(addonsDir, { recursive: true });
  try {
    fs.writeFileSync(path.join(addonsDir, "_READ ME.txt"),
      "Put each addon in its own folder here (the folder holds its addon.json), then restart RLC Hub Addon Manager.\r\n" +
      "Mets chaque addon dans son propre dossier ici (le dossier contient son addon.json), puis relance RLC Hub Addon Manager.\r\n\r\n" +
      "Folders starting with _ are ignored. / Les dossiers qui commencent par _ sont ignores.\r\n" +
      "Make your own addon / Creer ton addon: ..\\Make an addon\\ADDONS.md\r\n");
  } catch (_e) {}
  try {
    const kit = path.join(here, "addon-kit");
    if (fs.existsSync(kit)) copyTree(kit, path.join(root, "Make an addon"), () => false, "addon guide / guide addons");
  } catch (_e) {}

  // 5. launchers
  const argLine = '--user-data-dir="' + data + '"';
  fs.writeFileSync(path.join(root, "Launch RLC Hub Addon Manager.bat"),
    "@echo off\r\nrem RLC Hub Addon Manager by Milan. Launches the RLC Hub Addon Manager copy with its own data.\r\nstart \"\" \"%~dp0RL Career Hub\\RL Career Hub.exe\" --user-data-dir=\"%~dp0rl-career-hub (AppData)\"\r\n");
  try { fs.copyFileSync(path.join(here, "LICENSE.txt"), path.join(root, "LICENSE.txt")); } catch (_e) {}
  const desktop = psFolder("Desktop", path.join(os.homedir(), "Desktop"));
  let lnkOk = true;
  try {
    makeShortcut(path.join(root, "RLC Hub Addon Manager.lnk"), exe, argLine, game);
    makeShortcut(path.join(desktop, "RLC Hub Addon Manager.lnk"), exe, argLine, game);
  } catch (_e) { lnkOk = false; }

  fs.writeFileSync(path.join(root, "rlc-hubplus-version.txt"), "RLC Hub Addon Manager " + payload.mod + " for RL Career Hub " + baseVersion + "\r\n");
  say("", "");
  say("Done! RLC Hub Addon Manager v" + payload.mod + " is installed in " + root, "Termine ! RLC Hub Addon Manager v" + payload.mod + " est installe dans " + root);
  if (lnkOk) say('Start it with the "RLC Hub Addon Manager" shortcut on your desktop.', 'Lance-le avec le raccourci "RLC Hub Addon Manager" sur ton bureau.');
  else say('Start it with "Launch RLC Hub Addon Manager.bat" in that folder.', 'Lance-le avec "Launch RLC Hub Addon Manager.bat" dans ce dossier.');
  say("Addons go in " + addonsDir, "Les addons vont dans " + addonsDir);
  say("Your normal RL Career Hub is not modified.", "Ton RL Career Hub normal n'est pas modifie.");
}

try { main(); } catch (e) { fail(String(e && e.message || e), "erreur inattendue"); }
