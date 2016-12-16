const {app, BrowserWindow, Menu, dialog, ipcMain} = require('electron')
const path = require('path')
const url = require('url')

let win,
    pendingChanges = false;

ipcMain.on('fileModified', (ev, isModified) => {
    pendingChanges = isModified
})

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        minWidth: 475,
        minHeight: 300,
        width: 1000,
        height: 700,
    });

    Menu.setApplicationMenu(null)



    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'app', 'views', 'index.html'),
        protocol: 'file:',
        slashes: true
    }))

    if(process.env.NODE_ENV == 'development') {
        // Open the DevTools.
        win.webContents.openDevTools({
            mode: 'detach'
        })
    }

    win.webContents.once('dom-ready', function () {
        console.log('Ready to show')
        if (process.argv.length > 2) {
            win.webContents.send('openFile', process.argv[2])
        }
    })

    win.on('close', function (e) {
        if (pendingChanges) {
            let choice = dialog.showMessageBox(this,
                {
                    type: 'question',
                    buttons: ['Close without saving', 'Cancel', 'Save and close'],
                    title: 'Save changes before closing?',
                    message: 'If you don\'t save the changes, all changes since last save will be lost.'
                })
            switch (choice) {
                case 0:
                    return;
                case 1:
                    return e.preventDefault()
                case 2:
                    e.preventDefault()
                    win.webContents.send('saveFile')
                    ipcMain.on('fileModified', () => {
                        if(win) {
                            win.close()
                        }
                    })
            }
        }
    })

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})