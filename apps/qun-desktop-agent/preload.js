const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qun', {
  getConfig: () => ipcRenderer.invoke('qun:get-config'),
  saveConfig: value => ipcRenderer.invoke('qun:save-config', value),
  navigate: url => ipcRenderer.invoke('qun:navigate', url),
  browserAction: action => ipcRenderer.invoke('qun:browser-action', action),
  readPage: () => ipcRenderer.invoke('qun:read-page'),
  chat: prompt => ipcRenderer.invoke('qun:chat', prompt),
  localModelStatus: () => ipcRenderer.invoke('qun:local-model-status'),
  useLocalModel: value => ipcRenderer.invoke('qun:use-local-model', value),
  saveArtifact: value => ipcRenderer.invoke('qun:save-artifact', value),
  getMemory: () => ipcRenderer.invoke('qun:get-memory'),
  saveMemory: value => ipcRenderer.invoke('qun:save-memory', value),
  extensionStatus: () => ipcRenderer.invoke('qun:extension-status'),
  openExtensionFolder: kind => ipcRenderer.invoke('qun:open-extension-folder', kind),
  coreHealth: () => ipcRenderer.invoke('qun:core-health'),
  pairCore: value => ipcRenderer.invoke('qun:pair-core', value),
  coreDeviceHeartbeat: () => ipcRenderer.invoke('qun:core-device-heartbeat'),
  nodeHealth: () => ipcRenderer.invoke('qun:node-health'),
  bridgeHealth: () => ipcRenderer.invoke('qun:bridge-health'),
  setBrowserVisible: visible => ipcRenderer.invoke('qun:set-browser-visible', visible),
  onBrowserNavigated: callback => ipcRenderer.on('qun:browser-navigated', (_event, data) => callback(data))
});