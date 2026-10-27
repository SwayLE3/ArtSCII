const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const isMac = process.platform === 'darwin';

let win;
let currentFile = null;

function updateTitle() {
  win.setTitle(currentFile ? path.basename(currentFile) : 'Sans titre');
}

function newFile() {
  currentFile = null;
  win.webContents.send('file:new');
  updateTitle();
}

async function openFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return;

  const content = await fs.readFile(filePaths[0], 'utf8');
  currentFile = filePaths[0];
  win.webContents.send('file:opened', content);
  updateTitle();
}

function requestSave(saveAs) {
  win.webContents.send('file:request-save', saveAs);
}

ipcMain.handle('file:save', async (_event, content, saveAs) => {
  if (saveAs || !currentFile) {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: currentFile || 'sans-titre.txt',  });
    if (canceled || !filePath) return false;
    currentFile = filePath;
  }
  await fs.writeFile(currentFile, content, 'utf8');
  updateTitle();
  return true;
});

const template = [
  ...(isMac
    ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      }]
    : []),
  {
    label: 'Fichier',
    submenu: [
      { label: 'Nouveau', accelerator: 'CmdOrCtrl+N', click: newFile },
      { label: 'Ouvrir…', accelerator: 'CmdOrCtrl+O', click: openFile },
      { type: 'separator' },
      { label: 'Enregistrer', accelerator: 'CmdOrCtrl+S', click: () => requestSave(false) },
      { label: 'Enregistrer sous…', accelerator: 'CmdOrCtrl+Shift+S', click: () => requestSave(true) },
      { type: 'separator' },
      isMac ? { role: 'close', label: 'Fermer la fenêtre' } : { role: 'quit', label: 'Quitter' },
    ],
  },
  {
    label: 'Édition',
    submenu: [
      { role: 'undo', label: 'Annuler' },
      { role: 'redo', label: 'Rétablir' },
      { type: 'separator' },
      { role: 'cut', label: 'Couper' },
      { role: 'copy', label: 'Copier' },
      { role: 'paste', label: 'Coller' },
      { role: 'selectAll', label: 'Tout sélectionner' },
    ],
  },
];

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile('index.html');
  updateTitle();
  win.on('page-title-updated', (e) => e.preventDefault());

  win.on('focus', () => win.webContents.focus());
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
