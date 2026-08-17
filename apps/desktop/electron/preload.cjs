const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('pos', {
  version: '0.1.0',
});
