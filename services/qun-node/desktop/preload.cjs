const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qunUpdater", {
  getState: () => ipcRenderer.invoke("qun-updater:get-state"),
  check: () => ipcRenderer.invoke("qun-updater:check"),
  install: () => ipcRenderer.invoke("qun-updater:install"),
  onState: callback => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("qun-updater:state", listener);
    return () => ipcRenderer.removeListener("qun-updater:state", listener);
  }
});
