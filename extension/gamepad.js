/**
 * PAD//LINK Virtual Gamepad — injected into every page (MAIN world).
 *
 * Connects to the PAD//LINK server on this Mac (ws://127.0.0.1:8642) as a
 * "consumer" and mirrors the phone's controller state into the page through
 * the standard Gamepad API (navigator.getGamepads + gamepadconnected events).
 *
 * Cloud gaming sites and https://hardwaretester.com/gamepad poll
 * navigator.getGamepads() every frame — they see a standard-mapping
 * controller and show controller button prompts instead of keyboard keys.
 *
 * Bonus: game rumble (vibrationActuator.playEffect) is forwarded back to the
 * phone as vibration.
 */
(() => {
  if (window.__padlinkInstalled) return;
  window.__padlinkInstalled = true;

  const HOST = "127.0.0.1:8642";
  const ID = "PAD//LINK Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)";

  const state = {
    on: false,
    axes: [0, 0, 0, 0],
    buttons: new Array(17).fill(0),
    ts: 0,
  };
  let ws = null;

  const asButton = (v) => ({ pressed: v > 0.12, touched: v > 0, value: v });

  function makePad() {
    return {
      id: ID,
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: state.ts,
      axes: state.axes.slice(),
      buttons: state.buttons.map(asButton),
      hapticActuators: [],
      vibrationActuator: {
        type: "dual-rumble",
        playEffect(_type, p = {}) {
          try {
            if (ws && ws.readyState === 1) {
              ws.send(JSON.stringify({
                t: "rumble",
                d: Math.min(1000, p.duration || 100),
                m: Math.max(p.strongMagnitude || 0, p.weakMagnitude || 0),
              }));
            }
          } catch {}
          return Promise.resolve("complete");
        },
        reset() { return Promise.resolve("complete"); },
      },
    };
  }

  const native = navigator.getGamepads
    ? navigator.getGamepads.bind(navigator)
    : () => [null, null, null, null];

  Object.defineProperty(Navigator.prototype, "getGamepads", {
    configurable: true,
    writable: true,
    value: function getGamepads() {
      let pads;
      try { pads = Array.from(native() || []); } catch { pads = []; }
      while (pads.length < 4) pads.push(null);
      if (state.on) pads[0] = makePad();
      return pads;
    },
  });

  function emit(name) {
    const e = new Event(name);
    try { Object.defineProperty(e, "gamepad", { value: makePad() }); } catch {}
    window.dispatchEvent(e);
  }

  function connect() {
    try { ws = new WebSocket(`ws://${HOST}/?role=consumer`); }
    catch { setTimeout(connect, 3000); return; }

    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === "state") {
        state.axes = m.a || state.axes;
        state.buttons = m.b || state.buttons;
        state.ts = performance.now();
        if (!state.on) { state.on = true; emit("gamepadconnected"); }
      } else if (m.t === "off") {
        if (state.on) { state.on = false; emit("gamepaddisconnected"); }
      }
    };
    ws.onclose = () => {
      if (state.on) { state.on = false; emit("gamepaddisconnected"); }
      setTimeout(connect, 2000);
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }
  connect();
})();
