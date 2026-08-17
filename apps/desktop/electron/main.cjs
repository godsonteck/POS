const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('node:path');
const {
  createDatabase,
  verifyPin,
  listProducts,
  listCategories,
  checkout,
  listSales,
  getSale,
  listLowStock,
  createProduct,
  adjustStock,
} = require('./db.cjs');
const { openShift, getOpenShift, closeShift } = require('./shifts.cjs');
const { buildReceipt, printTcp, validateSaleForPrinting } = require('./receipt.cjs');

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
  ipcMain.handle('pos:catalog:low-stock', () => listLowStock(db));
  ipcMain.handle('pos:catalog:create-product', (_event, input) => createProduct(db, input, String(input?.actorId || '')));
  ipcMain.handle('pos:inventory:adjust-stock', (_event, input) => adjustStock(db, input, String(input?.actorId || '')));
  ipcMain.handle('pos:sales:checkout', (_event, input) => checkout(db, input));
  ipcMain.handle('pos:sales:list', (_event, filters) => listSales(db, filters || {}));
  ipcMain.handle('pos:sales:get', (_event, saleId) => getSale(db, String(saleId || '')));
  ipcMain.handle('pos:shift:open', (_event, input) => openShift(db, input));
  ipcMain.handle('pos:shift:current', (_event, staffId) => getOpenShift(db, String(staffId || '')));
  ipcMain.handle('pos:shift:close', (_event, input) => closeShift(db, input));
  ipcMain.handle('pos:receipt:preview', (_event, input) => {
    const sale = validateSaleForPrinting(getSale(db, String(input?.saleId || '')));
    return buildReceipt(sale, input?.options || {}).toString('base64');
  });
  ipcMain.handle('pos:receipt:print-network', async (_event, input) => {
    const sale = validateSaleForPrinting(getSale(db, String(input?.saleId || '')));
    const payload = buildReceipt(sale, input?.options || {});
    return printTcp(payload, String(input?.host || ''), Number(input?.port || 9100));
  });
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
