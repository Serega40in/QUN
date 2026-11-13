const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qun', {
  getConfig: () => ipcRenderer.invoke('qun:get-config'),
  saveConfig: value => ipcRenderer.invoke('qun:save-config', value),
  navigate: url => ipcRenderer.invoke('qun:navigate', url),
  browserAction: action => ipcRenderer.invoke('qun:browser-action', action),
  readPage: () => ipcRenderer.invoke('qun:read-page'),
  chat: prompt => ipcRenderer.invoke('qun:chat', prompt),
  coreHealth: () => ipcRenderer.invoke('qun:core-health'),
  nodeHealth: () => ipcRenderer.invoke('qun:node-health')
});
