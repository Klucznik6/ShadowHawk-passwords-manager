const { app, BrowserWindow } = require('electron')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1010,
    height: 600,
    minWidth: 1010,
    minHeight: 330
  })

  win.loadFile('src/index.html')
}

app.whenReady().then(() => {
  createWindow()
})