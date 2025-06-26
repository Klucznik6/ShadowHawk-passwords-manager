const { app, BrowserWindow } = require('electron')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 870,
    height: 600,
    minWidth: 860,
    minHeight: 330
  })

  win.loadFile('src/index.html')
}

app.whenReady().then(() => {
  createWindow()
})