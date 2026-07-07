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

// mouse-look loop (~60Hz) — applies right stick velocity while deflected
let mouseLoopRunning = false;
async function mouseLoop() {
  if (mouseLoopRunning) return;
  mouseLoopRunning = true;
  while (mouseLoopRunning) {
    const s = sticks.R;
    const mag = Math.hypot(s.x, s.y);
    if (s.mode === "mouse" && mag > s.deadzone) {
      try {
        const pos = await mouse.getPosition();
        const scale = ((mag - s.deadzone) / (1 - s.deadzone)) * s.sensitivity;
        const nx = pos.x + (s.x / (mag || 1)) * scale;
        const ny = pos.y + (s.y / (mag || 1)) * scale;
        await mouse.setPosition(new Point(Math.round(nx), Math.round(ny)));
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
}

// ---- server -----------------------------------------------------------------
const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
let clients = 0;

wss.on("connection", (ws, req) => {
  clients++;
  const ip = req.socket.remoteAddress;
  console.log(`🎮 Controller connected from ${ip} (${clients} active)`);
  mouseLoop();

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.t) {
      case "b": // button: { t:"b", k:"A", v:1|0 }
        await setButton(msg.k, msg.v === 1);
        break;
      case "s": { // stick: { t:"s", s:"L"|"R", x:-1..1, y:-1..1 }
        const stick = sticks[msg.s];
        if (!stick) return;
        stick.x = Math.max(-1, Math.min(1, +msg.x || 0));
        stick.y = Math.max(-1, Math.min(1, +msg.y || 0));
        if (stick.mode === "keys") await updateStickKeys(stick);
        break;
      }
      case "ping":
        ws.send(JSON.stringify({ t: "pong", id: msg.id }));
        break;
    }
  });

  ws.on("close", async () => {
    clients--;
    console.log(`🔌 Controller disconnected (${clients} active)`);
    if (clients === 0) {
      await releaseEverything(); // never leave keys stuck down
      mouseLoopRunning = false;
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
