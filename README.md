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

## How input maps

macOS has no userspace virtual-gamepad API, so games won't see an "Xbox
controller" — they see **keyboard + mouse**, which nearly every Mac game
supports. Defaults (edit `mapping.json`, restart server):

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

Right stick can be switched to arrow keys: set `rightStick.mode` to `"keys"`.
Tune `sensitivity` (mouse speed) and `deadzone` there too.

RT as a fire button: most shooters fire on mouse click — nut-js supports
`mouse.pressButton`, so wiring RT → left click is a 3-line change in
`server.js` if you want it (ping me).

## Latency

Expect ~10–30 ms on a decent WiFi network — the HUD at the top shows live
round-trip latency. Keep phone and Mac on the same 5 GHz band for best feel.

## Honest limitations

- Keyboard emulation, not a HID gamepad — no analog gradation for triggers,
  and games that *require* a controller (no keyboard bindings) won't work.
- iOS Safari doesn't support `navigator.vibrate`, so haptics are Android-only.
- Fullscreen/orientation lock behaves best in Chrome on Android; on iOS add
  it to the home screen for a chromeless experience.
