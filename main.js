const { app, BrowserWindow } = require('electron')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 890,
    height: 600,
    minWidth: 875,
    minHeight: 330
  })

  win.loadFile('src/index.html')
}

app.whenReady().then(() => {
  createWindow()
})