/**
 * PHONE GAMEPAD — Mac server
 * Serves the controller UI to your phone and translates touch input
 * into keyboard / mouse events on macOS.
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
const { WebSocketServer } = require("ws");
const qrcode = require("qrcode-terminal");
const { keyboard, mouse, Point, Key } = require("@nut-tree-fork/nut-js");

keyboard.config.autoDelayMs = 0;
mouse.config.autoDelayMs = 0;
mouse.config.mouseSpeed = 10000;

const PORT = process.env.PORT || 8642;
const mapping = JSON.parse(fs.readFileSync(path.join(__dirname, "mapping.json"), "utf8"));

// ---- key name -> nut-js Key enum -------------------------------------------
function resolveKey(name) {
  if (!name) return null;
  if (Key[name] !== undefined) return Key[name];
  // allow "1".."9" shorthand
  if (/^[0-9]$/.test(name)) return Key["Num" + name];
  if (name.length === 1) return Key[name.toUpperCase()];
  console.warn(`⚠ Unknown key in mapping.json: "${name}" — ignored`);
  return null;
}

const buttonKeys = {};
for (const [btn, keyName] of Object.entries(mapping.buttons || {})) {
  const k = resolveKey(keyName);
  if (k !== null) buttonKeys[btn] = k;
}

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

// ---- virtual gamepad state (mirrored to browser-extension tabs) --------------
// Standard Gamepad API button indices: https://w3c.github.io/gamepad/#remapping
const GP_INDEX = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  VIEW: 8, MENU: 9, L3: 10, R3: 11,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
};
const gpState = { axes: [0, 0, 0, 0], buttons: new Array(17).fill(0) };

// ---- input actions ----------------------------------------------------------
const pressedButtons = new Set();

async function setButton(name, down) {
  const key = buttonKeys[name];
  if (key === undefined) return;
  try {
    if (down && !pressedButtons.has(name)) {
      pressedButtons.add(name);
      await keyboard.pressKey(key);
    } else if (!down && pressedButtons.has(name)) {
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

// mouse loop (~60Hz) — applies right-stick velocity and touchpad deltas
let mouseLoopRunning = false;
async function mouseLoop() {
  if (mouseLoopRunning) return;
  mouseLoopRunning = true;
  while (mouseLoopRunning) {
    let mx = 0, my = 0;

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
  for (const name of [...pressedButtons]) await setButton(name, false);
  for (const s of Object.values(sticks)) {
    s.x = 0; s.y = 0;
    await updateStickKeys(s);
  }
  touchpad.dx = 0; touchpad.dy = 0; touchpad.scrollAcc = 0;
}

// ---- server -----------------------------------------------------------------
const app = express();
app.use(express.static(path.join(__dirname, "public")));
// controller UI reads this to show which key each button fires
app.get("/mapping.json", (req, res) => res.sendFile(path.join(__dirname, "mapping.json")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const phones = new Set();     // phone controller UIs
const consumers = new Set();  // browser tabs running the PAD//LINK extension

function gamepadMode() { return consumers.size > 0; }
function sendTo(set, obj) {
  const msg = JSON.stringify(obj);
  for (const c of set) if (c.readyState === 1) c.send(msg);
}
const broadcastState = () => sendTo(consumers, { t: "state", a: gpState.axes, b: gpState.buttons });
const broadcastMode = () => sendTo(phones, { t: "mode", g: gamepadMode() });

wss.on("connection", (ws, req) => {
  // browser extension attaching as a virtual gamepad consumer
  if ((req.url || "").includes("role=consumer")) {
    consumers.add(ws);
    console.log(`🕹  Virtual gamepad attached (${consumers.size} tab(s)) — keyboard/mouse mapping paused`);
    releaseEverything().catch(() => {});   // hand off cleanly: no held keys in gamepad mode
    broadcastMode();
    if (phones.size > 0) broadcastState();

    ws.on("message", (raw) => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      if (msg.t === "rumble") sendTo(phones, { t: "rumble", d: msg.d, m: msg.m }); // game rumble → phone vibration
    });
    ws.on("close", () => {
      consumers.delete(ws);
      broadcastMode();
      if (consumers.size === 0) console.log("🕹  Virtual gamepad detached — keyboard/mouse mapping resumed");
    });
    return;
  }

  phones.add(ws);
  const ip = req.socket.remoteAddress;
  console.log(`🎮 Controller connected from ${ip} (${phones.size} active)`);
  mouseLoop();
  ws.send(JSON.stringify({ t: "mode", g: gamepadMode() }));
  if (gamepadMode()) broadcastState();

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.t) {
      case "b": { // button: { t:"b", k:"A", v:1|0 }
        const idx = GP_INDEX[msg.k];
        if (idx !== undefined) {
          gpState.buttons[idx] = msg.v === 1 ? 1 : 0;
          if (gamepadMode()) broadcastState();
        }
        if (!gamepadMode()) await setButton(msg.k, msg.v === 1);
        break;
      }
      case "s": { // stick: { t:"s", s:"L"|"R", x:-1..1, y:-1..1 }
        const stick = sticks[msg.s];
        if (!stick) return;
        stick.x = Math.max(-1, Math.min(1, +msg.x || 0));
        stick.y = Math.max(-1, Math.min(1, +msg.y || 0));
        const o = msg.s === "L" ? 0 : 2;
        gpState.axes[o] = stick.x;
        gpState.axes[o + 1] = stick.y;
        if (gamepadMode()) broadcastState();
        else if (stick.mode === "keys") await updateStickKeys(stick);
        break;
      }
      case "m": // touchpad move: { t:"m", x:dx, y:dy } in screen px from phone
        touchpad.dx += (+msg.x || 0) * touchpad.sensitivity;
        touchpad.dy += (+msg.y || 0) * touchpad.sensitivity;
        break;
      case "c": // touchpad tap: { t:"c", b:"left"|"right" }
        try {
          if (msg.b === "right") await mouse.rightClick();
          else await mouse.leftClick();
        } catch (e) {
          console.error("click error:", e.message);
        }
        break;
      case "w": { // touchpad two-finger scroll: { t:"w", y:dy }
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
      case "ping":
        ws.send(JSON.stringify({ t: "pong", id: msg.id }));
        break;
    }
  });

  ws.on("close", async () => {
    phones.delete(ws);
    console.log(`🔌 Controller disconnected (${phones.size} active)`);
    if (phones.size === 0) {
      await releaseEverything(); // never leave keys stuck down
      mouseLoopRunning = false;
      gpState.axes = [0, 0, 0, 0];
      gpState.buttons.fill(0);
      sendTo(consumers, { t: "off" }); // extension reports pad disconnected
    }
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

server.listen(PORT, () => {
  const ips = lanIPs();
  const url = `http://${ips[0] || "localhost"}:${PORT}`;
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PHONE GAMEPAD server running");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  ips.forEach((ip) => console.log(`  →  http://${ip}:${PORT}`));
  console.log("\n  Open on your phone (same WiFi), or scan:\n");
  qrcode.generate(url, { small: true });
  console.log("  Edit mapping.json to change key bindings.");
  console.log("  If keys don't fire: grant Accessibility permission");
  console.log("  to your terminal in System Settings → Privacy.\n");
});

process.on("SIGINT", async () => {
  await releaseEverything();
  process.exit(0);
});
