# PAD//LINK BT — Bluetooth gamepad prototype (Android)

Makes the **phone itself** a Bluetooth HID gamepad, so a smart TV (Samsung
Gaming Hub, LG, Fire TV, Google TV) can pair with it like a real controller.
No PC, no server, no extension — the TV never knows it's a phone.

This is the **whitelist-risk prototype**: a bare-bones pad (D-pad, ABXY,
LB/RB, Select/Start) to answer one question — *does the TV's Xbox Cloud
Gaming app accept a generic Bluetooth HID gamepad?* If yes, the next step is
plugging the real PAD//LINK controller UI (WebView) into `HidGamepad`.

## Requirements

- Android 9+ phone (uses the `BluetoothHidDevice` API, added in API 28).
- The phone's Bluetooth stack must support the HID **device** role — most
  modern phones do; the app tells you on screen if yours doesn't.
- **iPhone is not supported** — iOS has no API to act as a Bluetooth
  peripheral. This path is Android-only by platform restriction.

## Build & install

```bash
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

(Or open `android/` in Android Studio and press Run.)

## Test procedure

1. **Sanity check against a Mac/PC first** (faster feedback than a TV):
   open the app, tap **Make discoverable**, then on the Mac:
   System Settings → Bluetooth → connect to *PAD//LINK Controller*.
   Open <https://hardwaretester.com/gamepad> in Chrome and press buttons on
   the phone — they should register as a standard gamepad.
2. **The real test — the TV**: on the TV go to its Bluetooth /
   controller-pairing screen (Samsung: Settings → Connection → External
   Device Manager, or straight from Gaming Hub's controller setup), make the
   phone discoverable, pair. Then open Xbox Cloud Gaming and see whether it
   accepts input.

## What we learn from each outcome

| Result | Meaning |
|---|---|
| TV pairs + Xbox app takes input | ✅ Ship it — wire the full PAD//LINK UI into `HidGamepad` |
| TV pairs, but Xbox app ignores the pad | The app whitelists controllers → next attempt: present a DualShock 4 HID descriptor/name instead of a generic pad |
| TV won't pair at all | Try another TV brand; if consistent, fall back to the ESP32 dongle idea |

## Files

- `app/src/main/java/dev/padlink/btpad/HidGamepad.kt` — HID device
  registration, report descriptor (2 sticks, hat, 16 buttons), report sending.
- `app/src/main/java/dev/padlink/btpad/MainActivity.kt` — permissions,
  discoverability, minimal test pad UI.
