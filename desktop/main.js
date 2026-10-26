const { app, BrowserWindow, protocol, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', 'app');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

protocol.registerSchemesAsPrivileged([{
  scheme: 'tide',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
}]);

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 900, minHeight: 620,
    backgroundColor: '#0a0a0c',
    title: 'Tide 潮汐',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.loadURL('tide://app/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  if (process.env.TIDE_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

app.whenReady().then(() => {
  protocol.handle('tide', async (req) => {
    try {
      const u = new URL(req.url);
      let p = decodeURIComponent(u.pathname);
      if (!p || p === '/') p = '/index.html';
      const file = path.normalize(path.join(ROOT, p));
      if (!file.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
      const data = await fs.promises.readFile(file);
      return new Response(new Uint8Array(data), {
        headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' },
      });
    } catch (e) {
      return new Response('not found', { status: 404 });
    }
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
