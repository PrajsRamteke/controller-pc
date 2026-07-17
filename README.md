<div align="center">

# 🎮 PAD//LINK

**Turn your phone into a wireless gamepad for your Mac or Windows PC.**

No app install on the phone — scan a QR code and play. Up to 4 players.

[![Release](https://img.shields.io/github/v/release/PrajsRamteke/controller-pc?label=latest&color=6c5ce7)](https://github.com/PrajsRamteke/controller-pc/releases/latest)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![Phone](https://img.shields.io/badge/phone-Android%20%7C%20iPhone-success)
![Latency](https://img.shields.io/badge/latency-~10--30ms%20WiFi%20·%20~1--5ms%20USB-orange)

<br>

<img src="screenshots/controller.png" alt="PAD//LINK touch controller — Midnight theme, 13 ms latency over WiFi" width="88%">

<br><br>

<img src="screenshots/rgb-controller.png" alt="PAD//LINK with RGB lighting cycling around the sticks and buttons" width="68%"> <img src="screenshots/mac-app.png" alt="PAD//LINK desktop app — scan the QR, watch P1–P4 fill up" width="19%">

<br>

*Midnight & RGB themes on the phone · the desktop app: scan → play*

<br>

🎬 **[▶ Watch the demo video](screenshots/demo.mp4)**

</div>

---

## ⬇️ Download

| Platform | Download | Notes |
|----------|----------|-------|
| 🍎 **macOS** (Apple Silicon) | [**PAD-LINK-1.0.0-mac-arm64.dmg**](https://github.com/PrajsRamteke/controller-pc/releases/latest/download/PAD-LINK-1.0.0-mac-arm64.dmg) | M1/M2/M3/M4 — drag to Applications |
| 🍎 **macOS** (Intel) | [**PAD-LINK-1.0.0-mac-x64.dmg**](https://github.com/PrajsRamteke/controller-pc/releases/latest/download/PAD-LINK-1.0.0-mac-x64.dmg) | Intel Macs — drag to Applications |
| 🪟 **Windows** (installer) | [**PAD-LINK-Setup-1.0.0-win-x64.exe**](https://github.com/PrajsRamteke/controller-pc/releases/latest/download/PAD-LINK-Setup-1.0.0-win-x64.exe) | Recommended |
| 🪟 **Windows** (portable) | [**PAD-LINK-Portable-1.0.0-win-x64.exe**](https://github.com/PrajsRamteke/controller-pc/releases/latest/download/PAD-LINK-Portable-1.0.0-win-x64.exe) | No install, just run |

> All builds are also on the [**Releases page**](https://github.com/PrajsRamteke/controller-pc/releases).
> The apps are unsigned — see [first-launch notes](#%EF%B8%8F-first-launch-unsigned-app-notes) below.

## 📦 Installation & Setup

Two ways to get PAD//LINK running — pick whichever suits you:

| | Path | Best for |
|---|------|----------|
| 🤖 | [**Install with AI**](#-option-1--install-with-ai-copy--paste) — copy one prompt, paste it into an AI agent, done | Fastest, zero terminal knowledge needed |
| 🔧 | [**Install manually**](#-option-2--install-manually) — step-by-step for macOS and Windows | Full control, no AI tools required |

### 🤖 Option 1 — Install with AI (copy & paste)

Using **Claude Code**, **Cursor**, **GitHub Copilot CLI**, **Windsurf**, or any AI coding agent?
Copy the prompt below, paste it into your agent, and it will detect your OS, download the
right build, handle the unsigned-app steps, and get you to the QR code — no manual work.

<details open>
<summary><b>📋 Copy this prompt</b></summary>

```text
Install and set up PAD//LINK (a phone-as-gamepad app) on this computer from
https://github.com/PrajsRamteke/controller-pc — do everything for me,
step by step, and tell me what you're doing as you go.

1. DETECT MY SYSTEM
   - Detect my OS and CPU architecture (macOS arm64 / macOS x64 / Windows x64).

2. DOWNLOAD THE RIGHT BUILD from the latest GitHub release
   (https://github.com/PrajsRamteke/controller-pc/releases/latest):
   - macOS Apple Silicon (M1–M4): PAD-LINK-<version>-mac-arm64.dmg
   - macOS Intel:                 PAD-LINK-<version>-mac-x64.dmg
   - Windows:                     PAD-LINK-Setup-<version>-win-x64.exe
     (or PAD-LINK-Portable-<version>-win-x64.exe if I prefer no installer)
   - If downloading a prebuilt app fails for any reason, fall back to running
     from source instead: check that Node.js 18+ is installed (install it if
     missing), then:
       git clone https://github.com/PrajsRamteke/controller-pc.git
       cd controller-pc && npm install && npm start

3. INSTALL IT
   - macOS: mount the .dmg, copy "PAD LINK.app" to /Applications, then remove
     the quarantine flag so the unsigned app opens without a warning:
       xattr -dr com.apple.quarantine "/Applications/PAD LINK.app"
   - Windows: run the Setup .exe. Warn me that SmartScreen will show a popup —
     I need to click "More info → Run anyway" (the app is unsigned, not
     malicious; source is public in the repo above).

4. HANDLE PERMISSIONS (important — the app silently fails without these)
   - macOS: open System Settings → Privacy & Security → Accessibility and tell
     me to enable "PAD LINK" (or the terminal app, if running from source).
     You can open that pane for me with:
       open "x-apple.systempreference:com.apple.preference.security?Privacy_Accessibility"
     Without this, macOS blocks all simulated key presses.
   - Windows: when the firewall prompt appears on first launch, tell me to
     click "Allow" for PRIVATE networks — otherwise my phone can't connect.

5. LAUNCH & VERIFY
   - Launch the app (macOS: open "/Applications/PAD LINK.app").
   - Confirm it's running and showing a QR code in its window.

6. TELL ME THE FINAL STEPS (these are on my phone, you can't do them)
   - Make sure my phone and this computer are on the SAME WiFi network.
   - Scan the QR code in the app window with my phone's camera.
   - Rotate the phone to landscape and tap once for fullscreen — then I'm
     playing.
   - Optional: if I want to play browser/cloud games (GeForce NOW, Xbox
     Cloud), also set up the Chrome extension BEFORE scanning: clone the
     repo, open chrome://extensions, enable Developer mode, "Load unpacked"
     → select the extension/ folder, then set Site access → "On all sites".

Ask me before doing anything destructive, and if any step fails, diagnose it
and try the next best alternative instead of stopping.
```

</details>

The agent will walk you through anything it can't do itself (like the macOS
Accessibility toggle and scanning the QR with your phone).

### 🔧 Option 2 — Install manually

<details>
<summary><b>🍎 macOS</b></summary>

1. **Download** the DMG for your chip from the [table above](#%EF%B8%8F-download)
   — `mac-arm64` for Apple Silicon (M1–M4), `mac-x64` for Intel.
2. **Open the DMG** and drag **PAD LINK** into **Applications**.
3. **First launch** — the app is unsigned, so either **right-click → Open**,
   or clear the quarantine flag in Terminal:
   ```bash
   xattr -dr com.apple.quarantine "/Applications/PAD LINK.app"
   ```
4. **Grant Accessibility permission** (required — key presses are silently
   blocked without it): *System Settings → Privacy & Security →
   Accessibility* → enable **PAD LINK**.
5. **Launch the app** — a QR code appears in the window.
6. On your phone (same WiFi): **scan the QR**, rotate to landscape, tap for
   fullscreen. Done. 🎉

</details>

<details>
<summary><b>🪟 Windows</b></summary>

1. **Download** the installer (`PAD-LINK-Setup-…-win-x64.exe`) from the
   [table above](#%EF%B8%8F-download) — or the **Portable** exe if you don't
   want to install anything.
2. **Run it.** SmartScreen will warn about an unsigned app — click
   **More info → Run anyway**.
3. **Firewall prompt** on first launch: click **Allow** for **private
   networks** — otherwise your phone can't reach the app.
4. **Launch the app** — a QR code appears in the window.
5. On your phone (same WiFi): **scan the QR**, rotate to landscape, tap for
   fullscreen. Done. 🎉

</details>

<details>
<summary><b>🛠️ From source (both platforms)</b></summary>

Needs [Node.js 18+](https://nodejs.org).

```bash
git clone https://github.com/PrajsRamteke/controller-pc.git
cd controller-pc
npm install
npm start        # QR code prints in the terminal — scan it with your phone
```

On macOS, grant Accessibility permission to your **terminal app** instead of
PAD LINK (*System Settings → Privacy & Security → Accessibility*), then
restart the server. See [Run from source](#%EF%B8%8F-run-from-source-instead-of-the-desktop-app)
below for building the desktop apps yourself.

</details>

> 🕹️ Playing **browser / cloud games** (GeForce NOW, Xbox Cloud)? Set up the
> [browser extension](#%EF%B8%8F-real-gamepad-mode--cloud-gaming--browser-games)
> **before** scanning the QR code.

## 🚀 Quick start (60 seconds)

1. **Download & open** the app for your computer (table above).
2. *Playing browser / cloud games (GeForce NOW, Xbox Cloud)?* Set up the
   **[browser extension](#%EF%B8%8F-real-gamepad-mode--cloud-gaming--browser-games)
   first** — it must be installed and allowed **before** you scan.
   For normal PC games (keyboard + mouse emulation), skip this step.
3. **Scan the QR code** shown in the app window with your phone
   (phone and computer on the same WiFi).
4. **Rotate to landscape, tap once** for fullscreen — you're playing. 🎉

The app window also shows the connection link (click to copy), a Wi-Fi / USB
endpoint switcher, and live **P1–P4** player slots.

### ⚠️ First launch (unsigned app notes)

- **macOS** — the app is unsigned, so the first launch needs
  **right-click → Open** (or `xattr -dr com.apple.quarantine "/Applications/PAD LINK.app"`).
  Then grant Accessibility permission to **PAD LINK**:
  *System Settings → Privacy & Security → Accessibility* — without this,
  macOS silently blocks the key presses.
- **Windows** — SmartScreen will warn on the unsigned installer: choose
  **More info → Run anyway**. If the firewall prompts, **allow on private
  networks**, otherwise the phone can't reach the app.

---

## ✨ What you get

- 🎮 **Xbox-style touch controller** — sticks, ABXY, triggers, D-pad, touchpad
- 👥 **4-player local multiplayer** — each phone gets its own color (P1–P4)
- 🖱️ **Swipe-to-look camera pad** with edge glide — way better than a fake right stick
- 📳 **Gyro aiming** — tilt the phone to aim (toggle in ⚙ settings)
- 🎨 **Theme skins** — Midnight, DualSense, Cyberpunk, Vaporwave, OLED Stealth, Retro CRT
- 🌈 **RGB lighting** — color-cycling glow around sticks and buttons, speed adjustable in ⚙ settings
- 💥 **Rumble** — game rumble vibrates the phone *and* ripples a shockwave across the pad
- 💾 **Profiles per game** — layout + button mapping saved, shareable via QR code
- ⌨️ **Keyboard passthrough** — type into the PC from your phone (chat, passwords)
- 📶 **Connection HUD** — live latency sparkline, packet-loss detection, auto-throttle
- 📲 **Install as an app (PWA)** — home-screen icon that auto-connects on launch
- 🔌 **USB wired mode** — ~1–5 ms latency over a cable

---

<details>
<summary><h3>🛠️ Run from source (instead of the desktop app)</h3></summary>

```bash
git clone https://github.com/PrajsRamteke/controller-pc.git
cd controller-pc
npm install
npm start
```

Scan the QR code printed in the terminal with your phone (same WiFi).

**macOS permission (one time):** the first time a key fires, macOS blocks it
silently unless your terminal has Accessibility access —
*System Settings → Privacy & Security → Accessibility* → enable **Terminal**
(or iTerm / VS Code, whichever runs the server). Restart the server after.

**Build the desktop apps yourself:**

```bash
npm run app        # run the Electron app unpackaged (dev)
npm run dist:mac   # → dist/PAD-LINK-<version>-mac-{arm64,x64}.dmg (+ .zip)
npm run dist:win   # → dist/PAD-LINK-Setup-<version>-win-x64.exe (+ portable exe)
```

The GitHub Actions workflow (`.github/workflows/build-apps.yml`) builds both
installers on real macOS/Windows runners — trigger it manually or push a
`v*` tag, then grab the artifacts.

</details>

<details>
<summary><h3>🕹️ Real gamepad mode — cloud gaming & browser games</h3></summary>

Browser games and cloud gaming sites (GeForce NOW, Xbox Cloud Gaming, etc. in
Chrome) detect controllers through the **Gamepad API**, not the keyboard. The
included browser extension makes PAD//LINK show up as a real standard-mapping
controller.

> ⚠️ **Order matters:** set up and allow the extension **before** you scan
> the QR code with your phone. The extension injects into a page when it
> loads — tabs opened before the extension was installed won't see the
> controller until you reload them.

**Step 1 — Install the extension (one time):**

1. Download / clone this repo (the extension lives in the `extension/` folder)
2. Chrome → `chrome://extensions` → toggle **Developer mode** (top-right)
3. Click **Load unpacked** → select the `extension/` folder
4. Allow it to run everywhere: click **Details** on the PAD//LINK card →
   **Site access → On all sites**. If Chrome shows an "allow" prompt, accept
   it — without site access the controller never appears in the game tab.

**Step 2 — Connect and play:**

5. Start the desktop app (or `npm start`)
6. **Now** scan the QR code with your phone
7. Open (or **reload**, if it was already open) the game tab —
   test at https://hardwaretester.com/gamepad: **"PAD//LINK Wireless
   Controller"** appears, and cloud gaming sites show controller button
   prompts

While a tab with the extension is attached, the server **pauses
keyboard/mouse mapping** (the phone HUD shows `GAMEPAD` instead of `KEYS`) so
buttons don't double-fire as keystrokes. Close the tab and keyboard mode
resumes automatically. Game rumble is forwarded to the phone as vibration
(Android). With multiple phones connected, they show up as gamepads 0–3.

> **Note:** this covers anything running **in the browser**. Native apps
> (Steam games, the GeForce NOW app) can't see it — for those, keyboard mode
> below is the answer.

</details>

<details>
<summary><h3>⌨️ How input maps (keyboard mode)</h3></summary>

When no extension tab is attached, games see **keyboard + mouse**, which
nearly every game supports. Defaults — edit the mapping from the phone
(⚙ settings) or in `mapping.json`:

| Control      | Sends            |
|--------------|------------------|
| Left stick   | W / A / S / D    |
| Right stick  | Mouse look       |
| A            | Space (jump)     |
| B            | Ctrl (crouch)    |
| X / Y        | R / F            |
| LB / RB      | Q / E            |
| LT           | Shift (sprint)   |
| RT           | Enter            |
| D-pad        | 1 / 2 / 3 / 4    |
| View / Menu  | Tab / Esc        |
| Touchpad     | Mouse move · tap = click · 2-finger = right-click / scroll |

- Right stick can send arrow keys instead: set `rightStick.mode` to `"keys"`.
- Tune `sensitivity` (mouse speed) and `deadzone` in `mapping.json`.
- **Stick response curve** — the right stick sends `magnitude^curve` (expo),
  so the middle of the stick is fine-grained for aiming while full deflection
  keeps full speed. Tune it with the "Stick response" slider (1 = linear).
- In the desktop app, "edit mapping" in the window footer opens the mapping
  file (restart the app after editing).

</details>

<details>
<summary><h3>🔌 Wired connection (USB — lowest latency)</h3></summary>

The server watches for new network interfaces and prints a fresh QR when a
cable shows up; the phone HUD shows **USB** instead of WIFI when it's on the
wire (~1–5 ms instead of 10–30 ms). Pick whichever fits your phone:

- **iPhone**: plug into the Mac → enable **Personal Hotspot** → scan the new
  QR. Works out of the box.
- **Android 14+ (macOS 13+)**: plug in → Settings → Hotspot & tethering →
  **USB tethering** → scan the new QR.
- **Any Android with USB debugging**: just plug in — if `adb` is installed
  the server auto-creates a tunnel; open `http://localhost:8642` on the phone.

**Bluetooth fallback** (no WiFi around): pair the phone with the computer and
enable **Bluetooth tethering** on the phone — same URL trick. Note it's
*slower* than WiFi (~30–60 ms), so only use it when there's no network.

</details>

<details>
<summary><h3>📲 Install on the phone (home-screen app)</h3></summary>

Open the pad once in the browser, then **⚙ settings → Install app**.

- **Full install** (service worker + offline shell + real install prompt)
  needs a secure context. The USB adb tunnel gives you one for free —
  `http://localhost:8642` counts as secure — so install from there for the
  best result.
- **Over WiFi** (`http://192.168.x.x`) browsers treat the page as insecure,
  so the button shows the manual path instead: browser menu →
  **Add to Home Screen** (iPhone: Share → Add to Home Screen). You still get
  the icon, fullscreen launch, and auto-connect — just no offline cache.
  Optional Chrome-on-Android workaround: `chrome://flags` →
  "Insecure origins treated as secure" → add `http://<computer-ip>:8642`.

Either way, tapping the icon launches straight into the controller and it
links up on its own — the pad remembers every address it has ever reached the
server on and cycles through them until one answers, so it survives IP
changes. No QR re-scan needed.

</details>

<details>
<summary><h3>📡 Latency & tips</h3></summary>

Expect **~10–30 ms** on a decent WiFi network (**~1–5 ms** wired) — the HUD
shows live round-trip latency plus a sparkline of the last 30 seconds.

- Keep phone and computer on the same **5 GHz** band for best feel.
- The touchpad light bar pulses **amber** when the connection is struggling;
  stick updates auto-throttle on weak WiFi.
- On connect, a console-style boot-up light wave sweeps across the controls
  and the light bar breathes into your player color. Losing the link plays
  the reverse sweep in red.

</details>

<details>
<summary><h3>⚠️ Honest limitations</h3></summary>

- Gamepad mode only works **inside the browser** (via the extension). Native
  apps see keyboard emulation — no analog triggers, and native games that
  *require* a controller won't work (macOS has no userspace virtual-HID API).
- iOS Safari doesn't support `navigator.vibrate`, so haptics are Android-only.
- Fullscreen/orientation lock behaves best in Chrome on Android; on iOS add
  the pad to the home screen for a chromeless experience.
- RT as a fire button: most shooters fire on mouse click — wiring
  RT → left click is a 3-line change in `server.js` if you want it (ping me).

</details>

---

<div align="center">

**Made with ❤️ — scan, rotate, play.**

</div>
