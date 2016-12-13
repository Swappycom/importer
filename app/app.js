const {remote, ipcRenderer} = require('electron')
const csv = require('fast-csv')
const swappy = require('swappy-client')
const url = require('url')
const path = require('path')
const fs = require('fs')
const Line = require('./app/Line')


const app = new Vue({
    el: '#app',
    data: {
        headers: Line.getHeaders(),
        lastClickedLine: null,
        access_token: null,
        filePath: null,
        lines: []
    },
    computed: {
        selectedLines() {
            return this.lines.filter((line) => {
                return line.selected
            })
        }
    },
    methods: {
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
                this.openFile(file[0]);
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
                });
        },
        saveFile() {
            let csvStream = csv.createWriteStream({headers: true}),
                writableStream = fs.createWriteStream(this.filePath)

            writableStream.on("finish", function () {
                ipcRenderer.send('fileModified', false)
            });

            csvStream.pipe(writableStream)
            for (let line of this.lines) {
                csvStream.write(line)
            }
            csvStream.end();

        },
        sendLines() {
            if (!this.lines.length) {
                return alert('Please select a CSV file first!')
            }
            let lines = this.selectedLines;
            if (!lines.length) {
                lines = this.lines;
            }
            console.log('Uploading', lines.length, 'lines')
            this.getClient((SwappyClient) => {
                console.log('Api loaded', SwappyClient)
                let oauthApi = new SwappyClient.OauthApi()
                oauthApi.getMe({}, (err, res, data) => {
                    if (err) {
                        return console.error(err)
                    }
                    console.log('Connected as', res.first_name, res.last_name)

                    this.uploadImages(lines, () => {
                        this.doSendLines(lines, () => {

                        });
                    })
                })
            })
        },
        uploadImages(lines, callback, index = 0) {
            if (index >= lines.length) {
                return callback();
            }
            let nextCallback = () => {
                    this.uploadImages(lines, callback, index + 1);
                },
                line = lines[index];
            if (line.areImagesReady()) {
                return nextCallback();
            }
            this.selectLine({}, index, line);

            let images = [];

            for (let image of line.getJson().images) {
                let imagePath = path.join(path.dirname(this.filePath), image),
                    stats = fs.lstatSync(imagePath);
                if (stats.isDirectory()) {
                    let fileNames = fs.readdirSync(imagePath);
                    for (let fileName of fileNames) {
                        if (fileName.substr(0, 1) !== '.') {
                            images.push(path.join(imagePath, fileName));
                        }
                    }
                } else if (stats.isFile()) {
                    images.push(imagePath);
                }
                this.doUpload(images, (urls) => {
                    line.images = urls.join('|');
                    nextCallback();
                });
            }
        },
        doUpload: function (images, callback, urls = []) {
            this.getClient((SwappyClient) => {
                let productsApi = new SwappyClient.ProductsApi();
                productsApi.uploadPicture(fs.createReadStream(images.pop()), {}, (err, results, response) => {
                    console.log(results);
                    urls.push(results[0].url);
                    if (images.length) {
                        this.doUpload(images, callback, urls);
                    } else {
                        callback(urls);
                    }
                })
            });
            this.selectLine({}, index, line);

        },
        doSendLines: function (lines, callback, index = 0) {
            if (index >= lines.length) {
                return callback();
            }
            let nextCallback = () => {
                    this.uploadImages(lines, callback, index + 1);
                },
                line = lines[index];
            if (!line.areImagesReady()) {
                nextCallback();
            }

            console.log(line.getJson());
            nextCallback();
        },
        getClient(callback) {
            this.authenticate((err, token) => {
                if (err) {
                    return console.error(err)
                }
                let SwappyClient = require('swappy-client'),
                    defaultClient = SwappyClient.ApiClient.instance
                defaultClient.authentications.oauth.accessToken = token

                callback(SwappyClient)
            })
        },
        authenticate(callback) {
            if (this.access_token) {
                return callback(null, this.access_token)
            } else {
                console.log('No access token');
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

            win.loadURL(authUrl + state)
            win.webContents.on('did-get-response-details', (event, status, newURL) => {
                if (String(newURL).match(/^https:\/\/api\.swappy\.com\/oauth2\/login_success/)) {
                    let parts = url.parse('?' + url.parse(newURL).hash.substr(1), true)
                    win.close()
                    if (parts.query.access_token) {
                        this.access_token = parts.query.access_token
                        callback(null, this.access_token)
                    } else {
                        callback('Error getting access token', null)
                    }
                }
            })

        },
        selectLine(ev, index, line){
            if (ev.altKey) return;
            if (!ev.ctrlKey) {
                for (let l of this.lines) {
                    l.selected = false;
                }
            }

            line.selected = !line.selected
            if (ev.shiftKey && this.lastClickedLine) {
                for (let i = Math.min(index, this.lastClickedLine); i <= Math.max(index, this.lastClickedLine); i++) {
                    console.log('Line', i, line.selected);
                    this.lines[i].selected = line.selected;
                }
            }
            this.lastClickedLine = index
        }
    }
})

let previousJson = '';
app.$watch('lines', () => {
    let json = [];
    for (let line of app.lines) {
        json.push(line.getJson());
    }
    json = JSON.stringify(json);
    if (json != previousJson) {
        console.log('File Modified')
        ipcRenderer.send('fileModified', true)
        previousJson = json;
    }
}, {deep: true});

ipcRenderer.on('saveFile', () => {
    app.saveFile()
})