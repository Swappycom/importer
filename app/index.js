const {remote, ipcRenderer} = require('electron')
const csv = require('fast-csv')
const swappy = require('swappy-client')
const url = require('url')
const path = require('path')
const fs = require('fs')
const Line = require('../Line')
const settings = require('electron-settings')

settings.get('account.token').then(val => {
    console.log('Fetched token', val)
    if (val) {
        app.setToken(val)
    }
})

const app = new Vue({
    el: '#app',
    data: {
        headers: Line.getHeaders(),
        lastClickedLine: null,
        access_token: null,
        login: null,
        filePath: null,
        lines: [],
        uploading: false,
        uploadMessages: [],
        uploadDone: false,
        uploadCanceled: false,
        showLine: {
            index: null,
            line: null
        }
    },
    computed: {
        selectedLines() {
            return this.lines.filter((line) => {
                return line.selected
            })
        }
    },
    methods: {
        cancelUpload() {
            console.error('Cancel upload');
            this.uploadCanceled = true
            this.uploadDone = true
        },
        addUploadMessage(message, error = false) {
            this.uploadMessages.unshift({
                message: message,
                error: error
            })
        },
        addUploadError(error) {
            this.addUploadMessage(error, true)
        },
        pushLine(data) {
            let line = new Line(data)
            this.lines.push(line)
        },
        openDialog() {

            let file = remote.dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    {name: 'Comma-Separated Values (CSV)', extensions: ['csv', 'txt']},
                    {name: 'All Files', extensions: ['*']}
                ]
            })
            if (file) {
                this.openFile(file[0])
            }
        },
        openFile(filePath) {
            //Save base dir
            this.filePath = filePath

            //Import CSV file
            this.lines = []
            csv
                .fromPath(filePath, {
                    headers: true
                })
                .on("data", (data) => {
                    this.pushLine(data)
                })
                .on("end", () => {
                    console.log('file', filePath, 'loaded')
                    ipcRenderer.send('fileModified', false)
                })
        },
        saveFile() {
            let csvStream = csv.createWriteStream({headers: true}),
                writableStream = fs.createWriteStream(this.filePath)

            writableStream.on("finish", function () {
                ipcRenderer.send('fileModified', false)
            })

            csvStream.pipe(writableStream)
            for (let line of this.lines) {
                csvStream.write(line)
            }
            csvStream.end()

        },
        sendLines() {
            if (!this.lines.length) {
                return alert('Please select a CSV file first!')
            }
            if (!this.access_token) {
                return this.authenticate((error) => {
                    if (error) {
                        this.addUploadMessage('Auth error: ' + error, true);
                        console.error('Authenticate error', error);
                        this.uploading = false
                        return
                    }
                    this.sendLines()
                })
            }
            let lines = this.selectedLines
            if (!lines.length) {
                lines = this.lines
            }

            //Reset errors
            for (let line of lines) {
                line.errors = [];
            }

            this.uploadMessages = [];
            this.uploading = lines.length
            this.addUploadMessage('Uploading ' + lines.length + ' lines...')
            this.uploadImages(lines, () => {
                this.addUploadMessage('All images ready, sending lines...')
                this.sendReadyLines(lines, () => {
                    this.addUploadMessage('Done!')
                    this.uploadDone = true
                })
            })
        },
        uploadImages(lines, callback, index = 0) {
            if (this.uploadCanceled) return;
            if (index >= lines.length) {
                return callback()
            }
            let nextCallback = () => {
                    this.uploadImages(lines, callback, index + 1)
                },
                line = lines[index]
            if (line.areImagesReady()) {
                return nextCallback()
            }
            this.selectLine({}, index, line)

            let imagesPath = []

            for (let image of line.getJson().images) {
                let imagePath = path.join(path.dirname(this.filePath), image.url)
                try {
                    let stats = fs.lstatSync(imagePath)
                    if (stats.isDirectory()) {
                        let fileNames = fs.readdirSync(imagePath)
                        for (let fileName of fileNames) {
                            if (fileName.substr(0, 1) !== '.') {
                                imagesPath.push(path.join(imagePath, fileName))
                            }
                        }
                    } else if (stats.isFile()) {
                        imagesPath.push(imagePath)
                    }
                } catch (e) {
                    let err = 'File/Directory not found ' + imagePath
                    line.errors.push({
                        field: 'images',
                        code: 'invalid',
                        message: err
                    })
                    this.addUploadError('File/Directory not found ' + err);
                    return nextCallback();
                }
            }
            this.addUploadMessage('Uploading ' + imagesPath.length + ' images for ' + line.title)
            this.doUpload(imagesPath, (err, urls) => {
                if (err) {
                    line.errors.push({
                        field: 'images',
                        code: 'invalid',
                        message: err
                    })
                }
                line.images = urls.join('|')
                nextCallback()
            })
        },
        doUpload: function (imagesPath, callback, urls = []) {
            if (this.uploadCanceled) return;
            this.getClient((error, SwappyClient) => {
                if (error) {
                    this.addUploadMessage('Error: ' + error, true);
                    this.uploading = false
                    return
                }
                let productsApi = new SwappyClient.ProductsApi()
                productsApi.uploadPicture(fs.createReadStream(imagesPath.pop()), {}, (err, results, response) => {
                    if (err) {
                        return callback(err, urls)
                    }
                    urls.push(results[0].url)
                    if (imagesPath.length) {
                        this.doUpload(imagesPath, callback, urls)
                    } else {
                        callback(null, urls)
                    }
                })
            })
        },
        sendReadyLines: function (lines, callback, index = 0) {
            if (this.uploadCanceled) return;
            if (index >= lines.length) {
                return callback()
            }
            let nextCallback = () => {
                    this.sendReadyLines(lines, callback, index + 1)
                },
                line = lines[index]
            if (!line.areImagesReady()) {
                return nextCallback()
            }
            this.doSendLine(line, nextCallback)
        },
        doSendLine(line, callback) {
            if (this.uploadCanceled) return;
            this.getClient((error, SwappyClient) => {
                if (error) {
                    this.addUploadMessage('Error: ' + error, true);
                    this.uploading = false
                    return
                }
                let productsApi = new SwappyClient.ProductsApi(),
                    product = new swappy.Product.constructFromObject(line.getJson()),
                    updating = !!line.id

                this.addUploadMessage('Importing product ' + line.title)

                let responseCallback = (err, data, response) => {
                    if (err) {
                        if (err.status == 422 && err.response.body.message == "Validation Failed") {
                            line.errors = err.response.body.errors
                            console.log('errors', err.response.body.errors)
                            this.addUploadError('Validation error importing product ' + line.title)
                            return callback()
                        } else {
                            console.error(err)
                            this.addUploadError('Unexpected error: ' + (err.response ? err.response.body.message : err))
                            return console.error(err)
                        }
                    }
                    line.selected = false
                    line.id = Number.parseInt(data.id)
                    if (updating) {
                        this.addUploadMessage('Product #' + line.id + ' updated!')
                    } else {
                        this.addUploadMessage('Product imported #' + line.id)
                    }
                    callback()
                }

                if (updating) {
                    productsApi.updateProduct(line.id, product, responseCallback)
                } else {
                    productsApi.createProduct(product, {}, responseCallback)
                }
            })
        },
        getClient(callback) {
            if (!this.access_token) {
                return this.authenticate((error) => {
                    if (error) {
                        callback(error)
                    } else {
                        this.getClient(callback)
                    }
                })
            }

            callback(null, swappy)
        },
        authenticate(callback) {
            if (this.access_token) {
                return callback(null, this.access_token)
            } else {
                console.log('No access token')
            }
            let authUrl = "https://api.swappy.com/oauth2/authorize?response_type=token&redirect_uri=https%3A%2F%2Fapi.swappy.com%2Foauth2%2Flogin_success&realm=Service&client_id=swapster&scope=addresses+sell+email&state=",
                state = Math.random()

            let win = new remote.BrowserWindow({
                resizable: false,
                parent: remote.getCurrentWindow(),
                modal: true,
                width: 520,
                height: 420,
                webPreferences: {
                    nodeIntegration: false
                }
            })
            let done = false
            win.loadURL(authUrl + state)
            win.webContents.on('did-get-response-details', (event, status, newURL) => {
                    if (String(newURL).match(/^https:\/\/api\.swappy\.com\/oauth2\/login_success/)) {
                        let parts = url.parse('?' + url.parse(newURL).hash.substr(1), true)
                        done = true
                        win.close()
                        if (parts.query.access_token) {
                            this.setToken(parts.query.access_token, (err, token) => {
                                if (typeof callback === 'function') {
                                    callback(err, token)
                                }
                            })
                        } else {
                            if (typeof callback === 'function') {
                                callback('Error getting access token', null)
                            }
                        }
                    }
                }
            )
            win.on('closed', () => {
                if (!done) {
                    callback('Canceled by user')
                }
                win = null
            })

        },
        setToken(token, callback) {
            this.access_token = token
            swappy.ApiClient.instance.authentications.oauth.accessToken = token
            settings.set('account', {
                token: token,
            })
            let oauthApi = new swappy.OauthApi()
            oauthApi.getMe({}, (err, res, data) => {
                if (err) {
                    console.error(err);
                    callback(err, null)
                }
                this.login = res.login
                if (typeof callback === 'function') {
                    callback(null, token)
                }
            })
        },
        selectLine(ev, index, line){
            if (ev.altKey) return
            if (!ev.ctrlKey) {
                for (let l of this.lines) {
                    l.selected = false
                }
            }

            line.selected = !line.selected
            if (ev.shiftKey && this.lastClickedLine) {
                for (let i = Math.min(index, this.lastClickedLine); i <= Math.max(index, this.lastClickedLine); i++) {
                    console.log('Line', i, line.selected)
                    this.lines[i].selected = line.selected
                }
            }
            this.lastClickedLine = index
        },
        showLineInfos(index, line) {
            console.log(line.getJson())
            this.showLine = {
                index: index,
                line: line
            }
        }
    }
})

let previousJson = ''
app.$watch('lines', () => {
    let json = []
    for (let line of app.lines) {
        json.push(line.getJson())
    }
    json = JSON.stringify(json)
    if (json != previousJson) {
        console.log('File Modified')
        ipcRenderer.send('fileModified', true)
        previousJson = json
    }
}, {deep: true})

ipcRenderer.on('saveFile', () => {
    app.saveFile()
})

ipcRenderer.on('openFile', (ev, file) => {
    app.openFile(file)
})