'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');

const { generateTree } = require('./treeBuilder');
const { exportTxt, TreeRenderer } = require('./exporter');

const isDev = process.argv.includes('--dev');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('dialog:selectFolder', async (_evt, opts = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || 'Select a folder',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: opts.defaultPath || undefined,
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('tree:generate', async (_evt, { rootDir, options }) => {
  if (!rootDir || !fs.existsSync(rootDir)) {
    return { error: 'Folder does not exist.' };
  }
  try {
    const { text, stats } = generateTree(rootDir, options || {});
    return { text, stats, rootDir };
  } catch (err) {
    return { error: err.message || String(err) };
  }
});

ipcMain.handle('export:run', async (_evt, payload) => {
  const { text, formats, outputDir, baseName, theme, title } = payload;
  if (!text) return { error: 'Nothing to export — generate a tree first.' };
  if (!outputDir || !fs.existsSync(outputDir)) {
    return { error: 'Choose a valid output folder.' };
  }

  const safeBase = (baseName || 'file-tree').replace(/[\\/:*?"<>|]/g, '_').trim() || 'file-tree';
  const saved = [];
  const errors = [];

  // One renderer (a single shared hidden window) for the whole batch.
  const needsRenderer = formats.some((f) => f === 'png' || f === 'pdf');
  const renderer = needsRenderer ? new TreeRenderer() : null;

  try {
    for (const format of formats) {
      const filePath = path.join(outputDir, `${safeBase}.${format}`);
      try {
        if (format === 'txt') {
          await exportTxt(text, filePath);
        } else if (format === 'png') {
          await renderer.toPng(text, filePath, { theme, title });
        } else if (format === 'pdf') {
          await renderer.toPdf(text, filePath, { theme, title });
        } else {
          continue;
        }
        saved.push(filePath);
      } catch (err) {
        errors.push(`${format.toUpperCase()}: ${err.message || String(err)}`);
      }
    }
  } finally {
    if (renderer) await renderer.dispose();
  }

  return { saved, errors };
});

ipcMain.handle('clipboard:write', async (_evt, text) => {
  clipboard.writeText(text || '');
  return true;
});

ipcMain.handle('shell:showItem', async (_evt, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('shell:openPath', async (_evt, target) => {
  if (target) await shell.openPath(target);
  return true;
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
