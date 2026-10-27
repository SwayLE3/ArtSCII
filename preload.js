const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileApi', {
  onNew: (callback) => ipcRenderer.on('file:new', () => callback()),
  onOpened: (callback) => ipcRenderer.on('file:opened', (_e, content) => callback(content)),
  onRequestSave: (callback) => ipcRenderer.on('file:request-save', (_e, saveAs) => callback(saveAs)),
  save: (content, saveAs) => ipcRenderer.invoke('file:save', content, saveAs),
});
