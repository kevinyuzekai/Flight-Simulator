/* 天际航线 SkyRoute — Windows 桌面版 (Electron)
 * 游戏文件打包在 app/ 目录, 通过自定义协议 app://skyroute/ 加载 (不是 file://):
 *  - 页面有固定的安全源 (app://skyroute), localStorage 设置可持久保存;
 *  - 联网地景瓦片 (AWS Terrain Tiles 返回 *, EOX 回显 Origin, NASA GIBS 返回 *) 均可正常跨域读取像素;
 *  - 无本地端口, 不会触发防火墙提示。
 * 手柄 / 飞行摇杆 (TCA 侧杆、油门台等) 通过 Chromium 的 Gamepad API 直接可用。 */
'use strict';
const { app, BrowserWindow, Menu, shell, session, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const TITLE = '天际航线 SkyRoute';
const APP_ROOT = path.join(__dirname, 'app');
const START_URL = 'app://skyroute/index.html';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

if (!app.requestSingleInstanceLock()) app.quit();

let mainWindow = null;

function serveApp(request) {
  let rel;
  try { rel = decodeURIComponent(new URL(request.url).pathname); } catch (_) { return new Response('bad request', { status: 400 }); }
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(APP_ROOT, rel));
  if (!file.startsWith(APP_ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return new Response('not found', { status: 404 });
  }
  return net.fetch(pathToFileURL(file).toString());
}

function openExternal(url) {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {});
}

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 600,
    title: TITLE, backgroundColor: '#0b2a5b',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); openExternal(url); } });
  // F11 全屏; Ctrl+Shift+I 开发者工具 (排查问题用). 其余按键全部交给游戏.
  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { mainWindow.setFullScreen(!mainWindow.isFullScreen()); e.preventDefault(); }
    else if (input.control && input.shift && input.key.toLowerCase() === 'i') { mainWindow.webContents.toggleDevTools(); e.preventDefault(); }
  });
  mainWindow.on('page-title-updated', (e) => { e.preventDefault(); mainWindow.setTitle(TITLE); });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(START_URL);
}

app.on('second-instance', () => {
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});

app.whenReady().then(() => {
  protocol.handle('app', serveApp);
  Menu.setApplicationMenu(null);   // 没有菜单栏: 避免菜单快捷键 (Alt / Ctrl+R 等) 抢走游戏按键
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { try { session.defaultSession.flushStorageData(); } catch (_) { /* ignore */ } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
