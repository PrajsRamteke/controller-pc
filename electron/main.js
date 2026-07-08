/**
 * PAD//LINK — desktop app shell (macOS + Windows)
 * Starts the gamepad server and shows a window with the QR code,
 * connection links and live player status.
 */
const { app, BrowserWindow, ipcMain, clipboard, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

// one instance only — a second launch just refocuses the window
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let gamepad = null;
let lastStatus = null;
let serverError = null;

// packaged app: keep mapping.json user-editable outside the asar archive
function ensureMappingPath() {
  const bundled = path.join(__dirname, "..", "mapping.json");
  if (!app.isPackaged) return bundled;
  const userCopy = path.join(app.getPath("userData"), "mapping.json");
  try {
    if (!fs.existsSync(userCopy)) fs.copyFileSync(bundled, userCopy);
    return userCopy;
  } catch {
    return bundled;
  }
}

async function payloadFrom(status) {
  const endpoints = [];
  for (const ep of status.endpoints) {
    let qr = null;
    try {
      qr = await QRCode.toDataURL(ep.url, {
        margin: 1,
        width: 560,
        color: { dark: "#0d1017", light: "#ffffff" },
      });
    } catch {}
    endpoints.push({ ...ep, qr });
  }
  return { ...status, endpoints, error: serverError };
}

async function pushStatus() {
  if (!win || win.isDestroyed() || !lastStatus) return;
  win.webContents.send("status", await payloadFrom(lastStatus));
}

function createWindow() {
  win = new BrowserWindow({
    width: 440,
    height: 720,
    minWidth: 380,
    minHeight: 600,
    title: "PAD//LINK",
    backgroundColor: "#0d1017",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu?.();
  win.loadFile(path.join(__dirname, "window.html"));
  win.on("closed", () => { win = null; });
}

app.on("second-instance", () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  process.env.MAPPING_PATH = ensureMappingPath();

  // start the gamepad server inside this process
  gamepad = require(path.join(__dirname, "..", "server.js"));
  gamepad.events.on("status", (st) => { lastStatus = st; pushStatus(); });
  gamepad.events.on("server-error", (err) => {
    serverError = err.code === "EADDRINUSE"
      ? `Port ${gamepad.PORT} is already in use — is another PAD//LINK (or npm start) running?`
      : err.message;
    pushStatus();
    if (!lastStatus) {
      lastStatus = { port: gamepad.PORT, players: [false, false, false, false], mode: "keys", endpoints: [] };
      pushStatus();
    }
  });

  ipcMain.handle("get-status", async () =>
    lastStatus ? payloadFrom(lastStatus) : null
  );
  ipcMain.on("copy", (_e, text) => clipboard.writeText(String(text)));
  ipcMain.on("open-external", (_e, url) => {
    if (/^https?:\/\//.test(String(url))) shell.openExternal(String(url));
  });
  ipcMain.on("open-mapping", () => shell.openPath(process.env.MAPPING_PATH));

  createWindow();

  app.on("activate", () => { if (!win) createWindow(); });
});

app.on("window-all-closed", () => app.quit());

app.on("before-quit", async (e) => {
  // never leave keys held down when the app closes
  if (gamepad?.releaseEverything) {
    e.preventDefault();
    try { await gamepad.releaseEverything(); } catch {}
    gamepad = null;
    app.quit();
  }
});
