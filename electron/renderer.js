/* PAD//LINK desktop window — renders server status pushed from main */
const $ = (id) => document.getElementById(id);

let status = null;
let selectedUrl = null; // endpoint the user picked; falls back to first

function currentEndpoint() {
  if (!status || !status.endpoints.length) return null;
  return status.endpoints.find((e) => e.url === selectedUrl) || status.endpoints[0];
}

function render() {
  if (!status) return;

  // mode badge
  const mode = $("mode");
  if (status.mode === "gamepad") {
    mode.textContent = "GAMEPAD";
    mode.className = "badge gamepad";
    mode.title = "Browser extension attached — phones act as real gamepads";
  } else {
    mode.textContent = "KEYS";
    mode.className = "badge keys";
    mode.title = "Phone input is mapped to keyboard + mouse";
  }

  // error banner
  const err = $("error");
  if (status.error) {
    err.textContent = status.error;
    err.classList.add("show");
  } else {
    err.classList.remove("show");
  }

  // QR + url for the selected endpoint
  const ep = currentEndpoint();
  if (ep) {
    if (ep.qr) {
      $("qrImg").src = ep.qr;
      $("qrImg").hidden = false;
      $("qrWaiting").hidden = true;
    }
    $("urlText").textContent = ep.url;
  } else {
    $("qrImg").hidden = true;
    $("qrWaiting").hidden = false;
    $("qrWaiting").textContent = status.error
      ? "Server not running"
      : "Waiting for network… connect this computer to Wi-Fi";
    $("urlText").textContent = "—";
  }

  // endpoint picker (only when there is more than one way in: Wi-Fi, USB…)
  const eps = $("endpoints");
  eps.classList.toggle("single", status.endpoints.length < 2);
  eps.innerHTML = "";
  for (const e of status.endpoints) {
    const b = document.createElement("button");
    b.textContent = e.label + (e.wired ? " ⚡" : "");
    b.className = ep && e.url === ep.url ? "active" : "";
    b.addEventListener("click", () => { selectedUrl = e.url; render(); });
    eps.appendChild(b);
  }

  // player slots
  const slots = $("players").children;
  status.players.forEach((on, i) => slots[i].classList.toggle("on", on));
}

// copy link
$("urlPill").addEventListener("click", () => {
  const ep = currentEndpoint();
  if (!ep) return;
  window.padlink.copy(ep.url);
  $("urlPill").classList.add("copied");
  $("copyHint").textContent = "COPIED";
  setTimeout(() => {
    $("urlPill").classList.remove("copied");
    $("copyHint").textContent = "COPY";
  }, 1400);
});

$("openBtn").addEventListener("click", () => {
  const ep = currentEndpoint();
  if (ep) window.padlink.openExternal(ep.url);
});

$("mappingBtn").addEventListener("click", () => window.padlink.openMapping());

$("permNote").textContent =
  window.padlink.platform === "darwin"
    ? "If keys don't fire: System Settings → Privacy & Security → Accessibility → enable PAD//LINK"
    : "Up to 4 phones can join — P1 drives keyboard & mouse";

window.padlink.onStatus((st) => { status = st; render(); });
window.padlink.getStatus().then((st) => { if (st) { status = st; render(); } });
