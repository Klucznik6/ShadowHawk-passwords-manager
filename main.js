const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('path')

// Fix GPU cache issues
app.commandLine.appendSwitch('--disable-gpu-sandbox')
app.commandLine.appendSwitch('--disable-software-rasterizer')
app.commandLine.appendSwitch('--disable-gpu-process-prelaunch')
app.commandLine.appendSwitch('--no-sandbox')
app.commandLine.appendSwitch('--disable-dev-shm-usage')
app.commandLine.appendSwitch('--disable-gpu-process-crash-limit')
app.commandLine.appendSwitch('--disable-disk-cache')
app.commandLine.appendSwitch('--disable-extensions-file-access-check')
app.commandLine.appendSwitch('--disable-web-security')
app.commandLine.appendSwitch('--ignore-certificate-errors')

// Keep a global reference of the window object
let mainWindow

const createWindow = () => {
  // Create the browser window with enhanced configuration
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    show: false, // Don't show until ready to prevent white flash
    // icon: path.join(__dirname, 'assets/icon.ico'), // Temporarily disabled - icon too large
    webPreferences: {
      nodeIntegration: false, // Security best practice
      contextIsolation: true, // Security best practice
      enableRemoteModule: false, // Security best practice
      webSecurity: false, // Temporarily disabled for cache issues
      experimentalFeatures: false,
      backgroundThrottling: false,
      offscreen: false,
      partition: 'persist:main',
      cache: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    backgroundColor: '#f8f9fa', // Prevents white flash on startup
    center: true
  })

  // Load the app
  mainWindow.loadFile('src/index.html')

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    // Focus on the window (especially important on macOS)
    if (process.platform === 'darwin') {
      mainWindow.focus()
    }
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Set application menu
  setApplicationMenu()

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }
}

// IPC handlers for window controls
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

// Create application menu
const setApplicationMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Password',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.executeJavaScript('if(typeof showAddPasswordModal === "function") showAddPasswordModal()')
          }
        },
        { type: 'separator' },
        {
          label: 'Logout',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow.webContents.executeJavaScript('if(typeof logout === "function") logout()')
          }
        },
        { type: 'separator' },
        process.platform === 'darwin' 
          ? { role: 'close' }
          : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ShadowHawk',
          click: () => {
            const { dialog } = require('electron')
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About ShadowHawk Password Manager',
              message: 'ShadowHawk Password Manager',
              detail: 'A secure, local password manager built with Electron.\n\nVersion: 1.0.0\nBuilt with security and privacy in mind.'
            })
          }
        }
      ]
    }
  ]

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })

    // Window menu
    template[4].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ]
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// App event handlers
app.whenReady().then(() => {
  // Clear any existing cache
  try {
    const { session } = require('electron')
    session.defaultSession.clearCache(() => {
      console.log('Cache cleared successfully')
    })
  } catch (error) {
    console.log('Cache clear failed:', error)
  }
  
  createWindow()

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    shell.openExternal(navigationUrl)
  })
})

// Handle GPU process crashes
app.on('gpu-process-crashed', (event, killed) => {
  console.log('GPU process crashed, restarting...')
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.reload()
  }
})

// Handle render process crashes
app.on('render-process-gone', (event, webContents, details) => {
  console.log('Render process gone:', details.reason)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.reload()
  }
})

// Handle certificate errors (for security)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault()
  callback(false)
})