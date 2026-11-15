const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  
  // App metadata
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // Native OS file save (for CSV / PDF export)
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  
  // Open external links in default browser
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  
  // Native OS notifications
  showNotification: (options) => ipcRenderer.invoke('app:showNotification', options),
});
