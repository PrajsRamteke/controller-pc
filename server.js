/**
 * PHONE GAMEPAD — Mac server
 * Serves the controller UI to your phone and translates touch input
 * into keyboard / mouse events on macOS. Up to 4 phones can connect
 * (players 1-4); the browser extension exposes them as real gamepads.
 *
 * Run:  npm install && npm start
 * Then scan the QR code with your phone (same WiFi).
 *
 * NOTE: macOS will ask for Accessibility permission the first time.
 * System Settings → Privacy & Security → Accessibility → enable your
 * terminal app (Terminal / iTerm / VS Code). Without it, no keys fire.
 */

const express = require("express");
const http = require("http");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const { WebSocketServer } = require("ws");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const { keyboard, mouse, screen, Point, Key, Button } = require("@nut-tree-fork/nut-js");

keyboard.config.autoDelayMs = 0;
mouse.config.autoDelayMs = 0;
mouse.config.mouseSpeed = 10000;

const PORT = process.env.PORT || 8642;
// packaged desktop app points this at a user-editable copy in its data dir
const MAPPING_PATH = process.env.MAPPING_PATH || path.join(__dirname, "mapping.json");
const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));

// status feed for the desktop app window (players / mode / reachable URLs)
const { EventEmitter } = require("events");
const appEvents = new EventEmitter();
function statusSnapshot() {
  return {
    port: PORT,
    players: players.map((p) => !!p),
    mode: gamepadMode() ? "gamepad" : "keys",
    endpoints: endpointList(),
  };
}
function emitStatus() {
  try { appEvents.emit("status", statusSnapshot()); } catch {}
}

// ---- key name -> nut-js Key enum -------------------------------------------
function resolveKey(name) {
  if (!name) return null;
  if (Key[name] !== undefined) return Key[name];
  // allow "1".."9" shorthand
  if (/^[0-9]$/.test(name)) return Key["Num" + name];
  if (typeof name === "string" && name.length === 1) return Key[name.toUpperCase()] ?? null;
  console.warn(`⚠ Unknown key in mapping: "${name}" — ignored`);
  return null;
}

function buildButtonKeys(btns) {
  const out = {};
  for (const [btn, keyName] of Object.entries(btns || {})) {
    const k = resolveKey(keyName);
    if (k !== null) out[btn] = k;
  }
  return out;
}
// live mapping — player 1's phone can replace it with a profile remap
let buttonKeys = buildButtonKeys(mapping.buttons);

const sticks = {
  L: {
    mode: mapping.leftStick.mode || "keys",
    deadzone: mapping.leftStick.deadzone ?? 0.3,
    sensitivity: mapping.leftStick.sensitivity ?? 18,
    keys: {
      up: resolveKey(mapping.leftStick.up),
      down: resolveKey(mapping.leftStick.down),
      left: resolveKey(mapping.leftStick.left),
      right: resolveKey(mapping.leftStick.right),
    },
    x: 0, y: 0,
    held: { up: false, down: false, left: false, right: false },
  },
  R: {
    mode: mapping.rightStick.mode || "mouse",
    deadzone: mapping.rightStick.deadzone ?? 0.25,
    sensitivity: mapping.rightStick.sensitivity ?? 18,
    keys: {
      up: resolveKey(mapping.rightStick.up),
      down: resolveKey(mapping.rightStick.down),
      left: resolveKey(mapping.rightStick.left),
      right: resolveKey(mapping.rightStick.right),
    },
    x: 0, y: 0,
    held: { up: false, down: false, left: false, right: false },
  },
};

const touchpad = {
  sensitivity: mapping.touchpad?.sensitivity ?? 2.4,
  scrollSensitivity: mapping.touchpad?.scrollSensitivity ?? 0.15,
  naturalScroll: mapping.touchpad?.naturalScroll ?? true,
  dx: 0, dy: 0, scrollAcc: 0,
};

const gyroSensitivity = mapping.gyro?.sensitivity ?? 3;
const lookSensitivity = mapping.lookpad?.sensitivity ?? 3.5;

// Absolute aim ("thumb = crosshair" position control): the pad's normalized
// coords (-1..1) map onto a centered on-screen box, and the cursor is warped to
// the matching absolute point — so where the thumb sits IS where the aim sits.
// aimRange = fraction of the screen the pad spans (0.7 = a comfy centre box).
const aimRange = mapping.aim?.range ?? 0.7;
const aimAbs = { active: false, nx: 0, ny: 0 };
let screenW = 0, screenH = 0;
(async () => {
  try { screenW = await screen.width(); screenH = await screen.height(); }
  catch (e) { console.error("screen size unavailable — absolute aim disabled:", e.message); }
})();

// ---- players (up to 4 phones) & virtual gamepad state ------------------------
// Standard Gamepad API button indices: https://w3c.github.io/gamepad/#remapping
const GP_INDEX = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  VIEW: 8, MENU: 9, L3: 10, R3: 11,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
};
const players = [null, null, null, null]; // { ws, axes:[4], buttons:[17] }
const consumers = new Set();              // browser tabs running the extension
const playerCount = () => players.filter(Boolean).length;

// ---- input actions (keyboard/mouse output — driven by player 1 only) ---------
const pressedButtons = new Map(); // name -> nut-js Key actually held
const heldPassKeys = new Set();   // desk-mode keys held via {t:"kd"} (nut-js Key values)
const heldMouse = new Set();      // desk-mode mouse buttons held via {t:"md"}

async function setButton(name, down) {
  try {
    if (down) {
      if (pressedButtons.has(name)) return;
      const key = buttonKeys[name];
      if (key === undefined) return;
      pressedButtons.set(name, key); // remember the exact key so remaps can't strand it
      await keyboard.pressKey(key);
    } else {
      const key = pressedButtons.get(name);
      if (key === undefined) return;
      pressedButtons.delete(name);
      await keyboard.releaseKey(key);
    }
  } catch (e) {
    console.error("key error:", e.message);
  }
}

async function setDirKey(stick, dir, active) {
  const key = stick.keys[dir];
  if (key === null || key === undefined) return;
  if (active === stick.held[dir]) return;
  stick.held[dir] = active;
  try {
    if (active) await keyboard.pressKey(key);
    else await keyboard.releaseKey(key);
  } catch (e) {
    console.error("stick key error:", e.message);
  }
}

async function updateStickKeys(stick) {
  const { x, y, deadzone } = stick;
  await setDirKey(stick, "right", x > deadzone);
  await setDirKey(stick, "left", x < -deadzone);
  await setDirKey(stick, "down", y > deadzone);
  await setDirKey(stick, "up", y < -deadzone);
}

// mouse loop (~60Hz) — applies right-stick velocity, touchpad and gyro deltas
let mouseLoopRunning = false;
async function mouseLoop() {
  if (mouseLoopRunning) return;
  mouseLoopRunning = true;
  while (mouseLoopRunning) {
    let mx = 0, my = 0;

    // Absolute aim wins the tick: warp the cursor straight to the thumb's point.
    if (!gamepadMode() && aimAbs.active && screenW && screenH) {
      const tx = Math.round(screenW / 2 + aimAbs.nx * (screenW * aimRange) / 2);
      const ty = Math.round(screenH / 2 + aimAbs.ny * (screenH * aimRange) / 2);
      try { await mouse.setPosition(new Point(tx, ty)); } catch (e) { /* transient */ }
      await new Promise((r) => setTimeout(r, 16));
      continue;
    }

    const s = sticks.R;
    const mag = Math.hypot(s.x, s.y);
    if (!gamepadMode() && s.mode === "mouse" && mag > s.deadzone) {
      const scale = ((mag - s.deadzone) / (1 - s.deadzone)) * s.sensitivity;
      mx += (s.x / (mag || 1)) * scale;
      my += (s.y / (mag || 1)) * scale;
    }

    if (touchpad.dx || touchpad.dy) {
      mx += touchpad.dx;
      my += touchpad.dy;
      touchpad.dx = 0;
      touchpad.dy = 0;
    }

    if (mx || my) {
      try {
        const pos = await mouse.getPosition();
        await mouse.setPosition(new Point(Math.round(pos.x + mx), Math.round(pos.y + my)));
      } catch (e) { /* ignore transient errors */ }
    }
    await new Promise((r) => setTimeout(r, 16));
  }
}

async function releaseEverything() {
  for (const name of [...pressedButtons.keys()]) await setButton(name, false);
  for (const s of Object.values(sticks)) {
    s.x = 0; s.y = 0;
    await updateStickKeys(s);
  }
  touchpad.dx = 0; touchpad.dy = 0; touchpad.scrollAcc = 0;
  aimAbs.active = false;
  for (const k of [...heldPassKeys]) {
    heldPassKeys.delete(k);
    try { await keyboard.releaseKey(k); } catch {}
  }
  for (const b of [...heldMouse]) {
    heldMouse.delete(b);
    try { await mouse.releaseButton(b); } catch {}
  }
}

// ---- server -----------------------------------------------------------------
const app = express();
app.use(express.static(path.join(__dirname, "public")));
// controller UI reads this to show which key each button fires
app.get("/mapping.json", (req, res) => res.sendFile(MAPPING_PATH));

// QR code for sharing a profile: /qr?d=<base64 profile json>
// Encodes a link back to this server so scanning it opens the pad and imports.
app.get("/qr", async (req, res) => {
  const d = String(req.query.d || "");
  if (!d || d.length > 6000) return res.status(400).send("bad payload");
  try {
    // use the host the phone itself reached us on, so the QR works on its network
    const host = req.get("host") || `${lanIPs()[0] || "localhost"}:${PORT}`;
    const url = `http://${host}/#p=${encodeURIComponent(d)}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 480 });
    res.type("image/svg+xml").send(svg);
  } catch (e) {
    res.status(500).send("qr error");
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---- liveness: a phone that locks its screen or drops off WiFi never sends a
// close frame, so its dead socket would ghost a player slot until the TCP
// timeout (minutes). Ping every 5s and reap sockets that don't answer.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 5000);

function gamepadMode() { return consumers.size > 0; }
function sendTo(set, obj) {
  const msg = JSON.stringify(obj);
  for (const c of set) if (c && c.readyState === 1) c.send(msg);
}
const sendPlayerState = (i) => {
  const p = players[i];
  if (p) sendTo(consumers, { t: "state", i, a: p.axes, b: p.buttons });
};
const broadcastMode = () => {
  const phoneWs = new Set(players.filter(Boolean).map((p) => p.ws));
  sendTo(phoneWs, { t: "mode", g: gamepadMode() });
};

// when a slot frees, shift the remaining players up so P2 becomes the new P1
// (and inherits keyboard/mouse control) instead of being stuck behind an
// empty slot forever. Each phone is told its new player number; the phone
// re-sends its profile remap when it learns it became P1.
function compactPlayers() {
  let changed = false;
  for (let i = 0; i < players.length; i++) {
    if (players[i]) continue;
    const j = players.findIndex((p, k) => k > i && p);
    if (j === -1) break;
    players[i] = players[j];
    players[j] = null;
    players[i].setSlot(i);
    sendTo(consumers, { t: "off", i: j });
    sendPlayerState(i);
    try { players[i].ws.send(JSON.stringify({ t: "player", i })); } catch {}
    console.log(`🎮 P${j + 1} promoted to P${i + 1}`);
    changed = true;
  }
  if (changed) emitStatus();
}

wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("error", () => {});

  // ---- browser extension attaching as a virtual gamepad consumer ----
  if ((req.url || "").includes("role=consumer")) {
    consumers.add(ws);
    console.log(`🕹  Virtual gamepad attached (${consumers.size} tab(s)) — keyboard/mouse mapping paused`);
    releaseEverything().catch(() => {});   // hand off cleanly: no held keys in gamepad mode
    broadcastMode();
    emitStatus();
    for (let i = 0; i < 4; i++) sendPlayerState(i);

    ws.on("message", (raw) => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      if (msg.t === "rumble") {
        // game rumble → that player's phone vibration
        const p = players[msg.i | 0];
        if (p) sendTo(new Set([p.ws]), { t: "rumble", d: msg.d, m: msg.m });
      }
    });
    ws.on("close", () => {
      consumers.delete(ws);
      broadcastMode();
      emitStatus();
      if (consumers.size === 0) console.log("🕹  Virtual gamepad detached — keyboard/mouse mapping resumed");
    });
    return;
  }

  // ---- phone controller: assign the lowest free player slot ----
  let slot = players.findIndex((p) => p === null);
  if (slot !== -1) {
    // setSlot keeps this connection's closure in sync when compactPlayers()
    // promotes it to a lower slot later
    players[slot] = { ws, axes: [0, 0, 0, 0], buttons: new Array(17).fill(0), setSlot: (n) => { slot = n; } };
  }
  const ip = req.socket.remoteAddress;
  if (slot === -1) {
    console.log(`🎮 Controller from ${ip} rejected — all 4 player slots taken`);
    // drop the socket shortly so the phone's auto-reconnect keeps retrying
    // and grabs a slot as soon as one frees, instead of hanging on "FULL"
    setTimeout(() => { try { ws.close(); } catch {} }, 1500);
  } else {
    console.log(`🎮 P${slot + 1} connected from ${ip} (${playerCount()}/4 players)`);
    emitStatus();
  }
  mouseLoop();
  ws.send(JSON.stringify({ t: "player", i: slot }));
  ws.send(JSON.stringify({ t: "mode", g: gamepadMode() }));
  // tell the phone which link it arrived on (wifi vs usb/tethered)
  {
    const local = (req.socket.localAddress || "").replace(/^::ffff:/, "");
    let linkName = "WiFi", wired = false;
    if (local === "127.0.0.1" || local === "::1") { wired = true; linkName = "USB (adb)"; }
    else if (ipInfo[local]) {
      linkName = ipInfo[local].port;
      wired = isWiredName(linkName);
    }
    ws.send(JSON.stringify({ t: "link", wired, n: linkName }));
    if (wired && slot !== -1) console.log(`   ↳ P${slot + 1} is on a wired link (${linkName})`);
  }
  if (slot !== -1) sendPlayerState(slot);

  const isP1 = () => slot === 0;

  ws.on("message", async (raw) => {
    ws.isAlive = true; // any traffic counts as a heartbeat
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const p = slot === -1 ? null : players[slot];

    switch (msg.t) {
      case "b": { // button: { t:"b", k:"A", v:1|0 }
        if (!p) return;
        const idx = GP_INDEX[msg.k];
        if (idx !== undefined) {
          p.buttons[idx] = msg.v === 1 ? 1 : 0;
          if (gamepadMode()) sendPlayerState(slot);
        }
        if (isP1() && !gamepadMode()) await setButton(msg.k, msg.v === 1);
        break;
      }
      case "s": { // stick: { t:"s", s:"L"|"R", x:-1..1, y:-1..1 }
        if (!p) return;
        const x = Math.max(-1, Math.min(1, +msg.x || 0));
        const y = Math.max(-1, Math.min(1, +msg.y || 0));
        const o = msg.s === "L" ? 0 : 2;
        p.axes[o] = x;
        p.axes[o + 1] = y;
        if (gamepadMode()) sendPlayerState(slot);
        if (isP1()) {
          const stick = sticks[msg.s];
          if (!stick) return;
          stick.x = x; stick.y = y;
          if (!gamepadMode() && stick.mode === "keys") await updateStickKeys(stick);
        }
        break;
      }
      case "m": // touchpad move: { t:"m", x:dx, y:dy } — P1 owns the shared mouse
        if (!isP1()) return;
        touchpad.dx += (+msg.x || 0) * touchpad.sensitivity;
        touchpad.dy += (+msg.y || 0) * touchpad.sensitivity;
        break;
      case "look": // look pad swipe: { t:"look", x:dx, y:dy } — camera deltas, own sensitivity
        if (!isP1()) return;
        touchpad.dx += (+msg.x || 0) * lookSensitivity;
        touchpad.dy += (+msg.y || 0) * lookSensitivity;
        break;
      case "g": // gyro aim: { t:"g", x:degX, y:degY } accumulated rotation
        if (!isP1()) return;
        touchpad.dx += (+msg.x || 0) * gyroSensitivity;
        touchpad.dy += (+msg.y || 0) * gyroSensitivity;
        break;
      case "aim": // absolute aim: { t:"aim", x:nx, y:ny } in -1..1 — thumb position = crosshair position
        if (!isP1()) return;
        aimAbs.active = true;
        aimAbs.nx = Math.max(-1, Math.min(1, +msg.x || 0));
        aimAbs.ny = Math.max(-1, Math.min(1, +msg.y || 0));
        break;
      case "aimend": // thumb lifted — stop holding the absolute aim point
        if (!isP1()) return;
        aimAbs.active = false;
        break;
      case "c": // touchpad tap: { t:"c", b:"left"|"right" }
        if (!isP1()) return;
        try {
          if (msg.b === "right") await mouse.rightClick();
          else await mouse.leftClick();
        } catch (e) {
          console.error("click error:", e.message);
        }
        break;
      case "w": { // touchpad two-finger scroll: { t:"w", y:dy }
        if (!isP1()) return;
        const dir = touchpad.naturalScroll ? -1 : 1;
        touchpad.scrollAcc += (+msg.y || 0) * touchpad.scrollSensitivity * dir;
        const steps = Math.trunc(touchpad.scrollAcc);
        if (steps !== 0) {
          touchpad.scrollAcc -= steps;
          try {
            if (steps > 0) await mouse.scrollDown(steps);
            else await mouse.scrollUp(-steps);
          } catch (e) {
            console.error("scroll error:", e.message);
          }
        }
        break;
      }
      case "remap": // profile button mapping from P1's phone: { t:"remap", buttons:{A:"Space",...} }
        if (!isP1()) return;
        if (msg.buttons && typeof msg.buttons === "object" && Object.keys(msg.buttons).length <= 32) {
          buttonKeys = buildButtonKeys(msg.buttons);
          console.log("⌨  Button mapping updated from P1's active profile");
        }
        break;
      case "type": // keyboard passthrough: { t:"type", s:"hello" }
        if (typeof msg.s === "string" && msg.s.length > 0 && msg.s.length <= 200) {
          try { await keyboard.type(msg.s); } catch (e) { console.error("type error:", e.message); }
        }
        break;
      case "key": { // single key press: { t:"key", k:"Enter" }
        const k = resolveKey(msg.k);
        if (k !== null) {
          try { await keyboard.pressKey(k); await keyboard.releaseKey(k); }
          catch (e) { console.error("key error:", e.message); }
        }
        break;
      }
      case "kd": { // desk mode key hold: { t:"kd", k:"LeftShift" } — held until "ku"
        if (!isP1()) return;
        const k = resolveKey(msg.k);
        if (k === null || heldPassKeys.has(k)) return;
        heldPassKeys.add(k);
        try { await keyboard.pressKey(k); } catch (e) { console.error("key error:", e.message); }
        break;
      }
      case "ku": { // desk mode key release: { t:"ku", k:"LeftShift" }
        if (!isP1()) return;
        const k = resolveKey(msg.k);
        if (k === null || !heldPassKeys.has(k)) return;
        heldPassKeys.delete(k);
        try { await keyboard.releaseKey(k); } catch (e) { console.error("key error:", e.message); }
        break;
      }
      case "md": { // desk mode mouse button hold (drag): { t:"md", b:"left"|"right" }
        if (!isP1()) return;
        const b = msg.b === "right" ? Button.RIGHT : Button.LEFT;
        if (heldMouse.has(b)) return;
        heldMouse.add(b);
        try { await mouse.pressButton(b); } catch (e) { console.error("mouse error:", e.message); }
        break;
      }
      case "mu": { // desk mode mouse button release
        if (!isP1()) return;
        const b = msg.b === "right" ? Button.RIGHT : Button.LEFT;
        if (!heldMouse.has(b)) return;
        heldMouse.delete(b);
        try { await mouse.releaseButton(b); } catch (e) { console.error("mouse error:", e.message); }
        break;
      }
      case "ping":
        ws.send(JSON.stringify({ t: "pong", id: msg.id }));
        break;
    }
  });

  ws.on("close", async () => {
    if (slot !== -1) {
      const wasSlot = slot;
      players[wasSlot] = null;
      slot = -1; // this connection is gone — never touch the players array again
      sendTo(consumers, { t: "off", i: wasSlot }); // extension reports this pad disconnected
      console.log(`🔌 P${wasSlot + 1} disconnected (${playerCount()}/4 players)`);
      emitStatus();
      if (wasSlot === 0) {
        await releaseEverything(); // never leave P1's keys stuck down
        buttonKeys = buildButtonKeys(mapping.buttons); // back to mapping.json defaults
      }
      compactPlayers(); // shift survivors up — P2 takes over as P1, etc.
    }
    if (playerCount() === 0) mouseLoopRunning = false;
  });
});

function lanIPs() {
  const out = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === "IPv4" && !i.internal) out.push(i.address);
    }
  }
  return out;
}

// ---- wired support: interface watching + labels ------------------------------
// USB tethering (iPhone Personal Hotspot / Android USB tethering) shows up as
// a new network interface. We watch for it, label it via networksetup, and
// print a fresh QR so the phone can jump onto the cable.
let portNames = {};        // device (en0) -> "Wi-Fi", "iPhone USB", ...
const ipInfo = {};         // ip -> { iface, port }
const knownIPs = new Set();
const isWiredName = (n) => !/wi-?fi|airport/i.test(n || "");

function refreshPortNames(cb) {
  if (process.platform !== "darwin") { if (cb) cb(); return; } // networksetup is macOS-only
  execFile("networksetup", ["-listallhardwareports"], (err, out) => {
    if (!err && out) {
      const map = {};
      let port = null;
      for (const line of out.split("\n")) {
        const p = line.match(/^Hardware Port:\s*(.+)/);
        const d = line.match(/^Device:\s*(.+)/);
        if (p) port = p[1].trim();
        else if (d && port) map[d[1].trim()] = port;
      }
      portNames = map;
    }
    if (cb) cb();
  });
}

function currentIPs() {
  const out = {};
  for (const [iface, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) out[a.address] = iface;
    }
  }
  return out;
}

// labeled URLs the phone can reach us on — feeds the desktop app window
function endpointList() {
  const ips = currentIPs();
  return Object.entries(ips).map(([ip, iface]) => ({
    url: `http://${ip}:${PORT}`,
    label: portNames[iface] || iface,
    wired: isWiredName(portNames[iface] || iface),
  }));
}

function scanInterfaces(announce) {
  const ips = currentIPs();
  let removed = false;
  for (const ip of [...knownIPs]) {
    if (!ips[ip]) { knownIPs.delete(ip); delete ipInfo[ip]; removed = true; }
  }
  const added = Object.keys(ips).filter((ip) => !knownIPs.has(ip));
  if (added.length === 0) { if (removed) emitStatus(); return; }
  refreshPortNames(() => {
    for (const ip of added) {
      knownIPs.add(ip);
      const iface = ips[ip];
      const port = portNames[iface] || iface;
      ipInfo[ip] = { iface, port };
      if (announce) {
        const url = `http://${ip}:${PORT}`;
        console.log(`\n🔗 New connection path: ${url}  (${port})`);
        if (isWiredName(port)) {
          console.log("   Looks wired/tethered — scan to switch to the cable:\n");
          qrcode.generate(url, { small: true });
        }
      }
    }
    emitStatus();
  });
}
setInterval(() => scanInterfaces(true), 3000);

// ---- wired support: automatic adb reverse tunnel (Android + USB debugging) ---
// If adb is installed and a phone is plugged in with USB debugging on, expose
// this server on the phone's own localhost so the cable carries the input.
const adbAnnounced = new Set();
function setupAdb() {
  execFile("adb", ["devices"], (err, out) => {
    if (err || !out) return; // adb not installed — that's fine
    const serials = out.split("\n").slice(1)
      .map((l) => l.trim().split(/\s+/))
      .filter((p) => p[1] === "device")
      .map((p) => p[0]);
    for (const s of serials) {
      execFile("adb", ["-s", s, "reverse", `tcp:${PORT}`, `tcp:${PORT}`], (e) => {
        if (!e && !adbAnnounced.has(s)) {
          adbAnnounced.add(s);
          console.log(`🔌 USB (adb): tunnel ready — open http://localhost:${PORT} on phone ${s}`);
        }
      });
    }
    for (const s of [...adbAnnounced]) if (!serials.includes(s)) adbAnnounced.delete(s);
  });
}
setInterval(setupAdb, 5000);
setupAdb();

server.on("error", (err) => {
  console.error("Server error:", err.message);
  appEvents.emit("server-error", err);
});

server.listen(PORT, () => {
  const ips = lanIPs();
  const url = `http://${ips[0] || "localhost"}:${PORT}`;
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PHONE GAMEPAD server running");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  scanInterfaces(false); // seed the interface table without re-announcing
  refreshPortNames(() => {
    const labeled = currentIPs();
    Object.entries(labeled).forEach(([ip, iface]) => {
      console.log(`  →  http://${ip}:${PORT}  (${portNames[iface] || iface})`);
    });
  });
  console.log("\n  Open on your phone (same WiFi or USB tethering), or scan:\n");
  qrcode.generate(url, { small: true });
  console.log("  Up to 4 phones can join (P1 drives keyboard/mouse mode).");
  console.log("  Wired: plug the phone in + enable USB tethering / Personal");
  console.log("  Hotspot (or Android USB debugging for an automatic tunnel).");
  console.log("  If keys don't fire: grant Accessibility permission");
  console.log("  to your terminal in System Settings → Privacy.\n");
  emitStatus();
});

process.on("SIGINT", async () => {
  await releaseEverything();
  process.exit(0);
});

// consumed by the desktop app (electron/main.js); harmless under plain `node server.js`
module.exports = { events: appEvents, PORT, statusSnapshot, releaseEverything };
