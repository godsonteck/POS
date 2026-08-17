const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('node:path');
const { createDatabase, verifyPin, listProducts, listCategories, checkout } = require('./db.cjs');

const isDev = !app.isPackaged;
let db;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#080c16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
}

function registerIpc() {
  ipcMain.handle('pos:session:login', (_event, input) => verifyPin(db, String(input?.username || ''), String(input?.pin || '')));
  ipcMain.handle('pos:catalog:products', () => listProducts(db));
  ipcMain.handle('pos:catalog:categories', () => listCategories(db));
  ipcMain.handle('pos:sales:checkout', (_event, input) => checkout(db, input));
  ipcMain.handle('pos:health', () => ({ database: 'ok', online: false, pendingSync: Number(db.prepare("SELECT COUNT(*) AS count FROM sync_outbox WHERE status='pending'").get().count) }));
}

app.whenReady().then(() => {
  db = createDatabase(app.getPath('userData'));
  registerIpc();
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://* http://localhost:*;"] } });
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { if (db) db.close(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
