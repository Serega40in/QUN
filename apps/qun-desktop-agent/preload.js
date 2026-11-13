const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qun', {
  getConfig: () => ipcRenderer.invoke('qun:get-config'),
  saveConfig: value => ipcRenderer.invoke('qun:save-config', value),
  navigate: url => ipcRenderer.invoke('qun:navigate', url),
  browserAction: action => ipcRenderer.invoke('qun:browser-action', action),
  readPage: () => ipcRenderer.invoke('qun:read-page'),
  chat: prompt => ipcRenderer.invoke('qun:chat', prompt),
  coreHealth: () => ipcRenderer.invoke('qun:core-health'),
  pairCore: value => ipcRenderer.invoke('qun:pair-core', value),
  coreDeviceHeartbeat: () => ipcRenderer.invoke('qun:core-device-heartbeat'),
  nodeHealth: () => ipcRenderer.invoke('qun:node-health'),
  setBrowserVisible: visible => ipcRenderer.invoke('qun:set-browser-visible', visible),
  onBrowserNavigated: callback => ipcRenderer.on('qun:browser-navigated', (_event, data) => callback(data))
});

[executed on device: S40in-LenovoIdeapad-White (0ba7026d-d272-4d74-9960-a5d220722248)]
