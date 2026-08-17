const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pos', {
  version: '0.4.0',
  session: {
    login: (input) => ipcRenderer.invoke('pos:session:login', input),
  },
  catalog: {
    products: () => ipcRenderer.invoke('pos:catalog:products'),
    categories: () => ipcRenderer.invoke('pos:catalog:categories'),
    lowStock: () => ipcRenderer.invoke('pos:catalog:low-stock'),
    createProduct: (input) => ipcRenderer.invoke('pos:catalog:create-product', input),
  },
  inventory: {
    adjustStock: (input) => ipcRenderer.invoke('pos:inventory:adjust-stock', input),
  },
  sales: {
    checkout: (input) => ipcRenderer.invoke('pos:sales:checkout', input),
    list: (filters) => ipcRenderer.invoke('pos:sales:list', filters || {}),
    get: (saleId) => ipcRenderer.invoke('pos:sales:get', saleId),
  },
  shift: {
    open: (input) => ipcRenderer.invoke('pos:shift:open', input),
    current: (staffId) => ipcRenderer.invoke('pos:shift:current', staffId),
    close: (input) => ipcRenderer.invoke('pos:shift:close', input),
  },
  receipt: {
    preview: (input) => ipcRenderer.invoke('pos:receipt:preview', input),
    printNetwork: (input) => ipcRenderer.invoke('pos:receipt:print-network', input),
  },
  health: () => ipcRenderer.invoke('pos:health'),
});
