# PAD//LINK — phone as WiFi gamepad for your Mac

Your phone becomes an Xbox-style touch controller. A Node server on the Mac
receives input over WebSocket and injects keyboard + mouse events. No app
install on the phone — just a URL.

## Setup (Mac)

```bash
cd phone-gamepad
npm install
npm start
```

Scan the QR code printed in the terminal with your phone (same WiFi), rotate
to landscape, tap once to go fullscreen. Done.

## macOS permission (one time, required)

The first time a key fires, macOS blocks it silently unless your terminal has
Accessibility access:

System Settings → Privacy & Security → Accessibility → enable **Terminal**
(or iTerm / VS Code — whichever runs the server). Restart the server after.

## Real gamepad mode (cloud gaming / hardwaretester.com)

Browser games and cloud gaming sites (GeForce NOW, Xbox Cloud Gaming, etc. in
Chrome) detect controllers through the **Gamepad API**, not the keyboard. The
included browser extension makes PAD//LINK show up as a real standard-mapping
controller:

1. Chrome → `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the `extension/` folder in this repo
3. Start the server (`npm start`) and connect your phone
4. Open https://hardwaretester.com/gamepad — "PAD//LINK Wireless Controller"
   appears, and cloud gaming sites show controller button prompts

While a tab with the extension is attached, the server **pauses keyboard/mouse
mapping** (the phone HUD shows `GAMEPAD` instead of `KEYS`) so buttons don't
double-fire as keystrokes. Close the tab and keyboard mode resumes
automatically. Game rumble is forwarded to the phone as vibration (Android).

Note: this covers anything running **in the browser**. Native Mac apps (Steam
games, the GeForce NOW app) can't see it — macOS has no userspace
virtual-HID API — so for those, keyboard mode below is the answer.

## How input maps (keyboard mode)

When no extension tab is attached, games see **keyboard + mouse**, which
nearly every Mac game supports. Defaults (edit `mapping.json`, restart
server):

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

Right stick can be switched to arrow keys: set `rightStick.mode` to `"keys"`.
Tune `sensitivity` (mouse speed) and `deadzone` there too.

RT as a fire button: most shooters fire on mouse click — nut-js supports
`mouse.pressButton`, so wiring RT → left click is a 3-line change in
`server.js` if you want it (ping me).

## Features

- **Local multiplayer** — up to 4 phones connect at once (P1–P4, each with its
  own accent color). The extension exposes them as gamepads 0–3. P1's phone
  drives keyboard/mouse mode and owns the shared touchpad/mouse.
- **Gyro aiming** — toggle in ⚙ settings; tilt the phone to move the camera
  (sent as mouse movement). Sensitivity slider on the phone, base multiplier
  in `mapping.json` → `gyro.sensitivity`. iOS asks for motion permission.
- **Profiles** — layout *and* button mapping saved per game, switchable in
  settings. Edit the button mapping from the phone (no more hand-editing
  `mapping.json`). Share a profile as a QR code: the other phone scans it,
  the pad opens and imports it.
- **Keyboard passthrough** — the ⌨ HUD button opens your phone keyboard and
  types live into the Mac (chat, lobby names, passwords), with quick keys for
  Enter/Esc/Tab/arrows.
- **Connection quality** — live latency sparkline in the HUD, packet-loss
  detection, and auto-throttling of stick updates on weak WiFi. The touchpad
  light bar pulses **amber** when the connection is struggling.
- **Haptic + sound themes** — distinct vibration patterns per button group
  (triggers feel different from face buttons), Light/Medium/Heavy strength,
  and optional synthesized UI clicks.

## Latency

Expect ~10–30 ms on a decent WiFi network — the HUD shows live round-trip
latency plus a sparkline of the last 30 seconds. Keep phone and Mac on the
same 5 GHz band for best feel.

## Honest limitations

- Gamepad mode only works inside the browser (via the extension). Native Mac
  apps see keyboard emulation — no analog triggers, and native games that
  *require* a controller won't work.
- iOS Safari doesn't support `navigator.vibrate`, so haptics are Android-only.
- Fullscreen/orientation lock behaves best in Chrome on Android; on iOS add
  it to the home screen for a chromeless experience.
