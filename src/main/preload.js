'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: (opts) => ipcRenderer.invoke('dialog:selectFolder', opts),
  generateTree: (rootDir, options) => ipcRenderer.invoke('tree:generate', { rootDir, options }),
  export: (payload) => ipcRenderer.invoke('export:run', payload),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItem', filePath),
  openPath: (target) => ipcRenderer.invoke('shell:openPath', target),
  platform: process.platform,
});
