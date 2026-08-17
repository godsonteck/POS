const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pos', {
  version: '0.1.0',
  session: {
    login: (input) => ipcRenderer.invoke('pos:session:login', input),
  },
  catalog: {
    products: () => ipcRenderer.invoke('pos:catalog:products'),
    categories: () => ipcRenderer.invoke('pos:catalog:categories'),
  },
  sales: {
    checkout: (input) => ipcRenderer.invoke('pos:sales:checkout', input),
  },
  health: () => ipcRenderer.invoke('pos:health'),
});
