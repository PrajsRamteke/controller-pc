/**
 * PAD//LINK Virtual Gamepad — injected into every page (MAIN world).
 *
 * Connects to the PAD//LINK server on this Mac (ws://127.0.0.1:8642) as a
 * "consumer" and mirrors up to 4 phones (players 1-4) into the page through
 * the standard Gamepad API (navigator.getGamepads + gamepadconnected events).
 *
 * Cloud gaming sites and https://hardwaretester.com/gamepad poll
 * navigator.getGamepads() every frame — they see standard-mapping
 * controllers at indices 0-3 and show controller button prompts.
 *
 * Game rumble (vibrationActuator.playEffect) is forwarded back to the
 * matching player's phone as vibration.
 */
(() => {
  if (window.__padlinkInstalled) return;
  window.__padlinkInstalled = true;

  const HOST = "127.0.0.1:8642";
  const idFor = (i) =>
    `PAD//LINK P${i + 1} Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)`;

  // per-player state: null = not connected
  const states = [null, null, null, null]; // { axes:[4], buttons:[17], ts }
  let ws = null;

  const asButton = (v) => ({ pressed: v > 0.12, touched: v > 0, value: v });

  function makePad(i) {
    const s = states[i] || { axes: [0, 0, 0, 0], buttons: new Array(17).fill(0), ts: 0 };
    return {
      id: idFor(i),
      index: i,
      connected: true,
      mapping: "standard",
      timestamp: s.ts,
      axes: s.axes.slice(),
      buttons: s.buttons.map(asButton),
      hapticActuators: [],
      vibrationActuator: {
        type: "dual-rumble",
        playEffect(_type, p = {}) {
          try {
            if (ws && ws.readyState === 1) {
              ws.send(JSON.stringify({
                t: "rumble",
                i,
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
      for (let i = 0; i < 4; i++) if (states[i]) pads[i] = makePad(i);
      return pads;
    },
  });

  function emit(name, i) {
    const e = new Event(name);
    try { Object.defineProperty(e, "gamepad", { value: makePad(i) }); } catch {}
    window.dispatchEvent(e);
  }

  function dropAll() {
    for (let i = 0; i < 4; i++) {
      if (states[i]) { const gp = i; states[i] = null; emit("gamepaddisconnected", gp); }
    }
  }

  function connect() {
    try { ws = new WebSocket(`ws://${HOST}/?role=consumer`); }
    catch { setTimeout(connect, 3000); return; }

    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === "state") {
        const i = m.i | 0;
        if (i < 0 || i > 3) return;
        const isNew = !states[i];
        states[i] = { axes: m.a || [0, 0, 0, 0], buttons: m.b || new Array(17).fill(0), ts: performance.now() };
        if (isNew) emit("gamepadconnected", i);
      } else if (m.t === "off") {
        const i = m.i | 0;
        if (states[i]) { states[i] = null; emit("gamepaddisconnected", i); }
      }
    };
    ws.onclose = () => { dropAll(); setTimeout(connect, 2000); };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }
  connect();
})();
