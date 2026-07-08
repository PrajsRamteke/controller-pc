const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("padlink", {
  platform: process.platform,
  getStatus: () => ipcRenderer.invoke("get-status"),
  onStatus: (cb) => ipcRenderer.on("status", (_e, st) => cb(st)),
  copy: (text) => ipcRenderer.send("copy", text),
  openExternal: (url) => ipcRenderer.send("open-external", url),
  openMapping: () => ipcRenderer.send("open-mapping"),
});
