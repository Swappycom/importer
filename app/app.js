const {remote} = require('electron')
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
        baseDir: null,
        lines: []
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
                //Save base dir
                this.baseDir = path.dirname(file[0])

                //Import CSV file
                this.lines = []
                csv
                    .fromPath(file[0], {
                        headers: true
                    })
                    .on("data", (data) => {
                        this.pushLine(data)
                    })
            }
        },
        sendLines() {
            if (!this.lines.length) {
                return alert('Please select a CSV file first!')
            }
            this.getClient((SwappyClient) => {
                console.log('Api loaded', SwappyClient)
                let oauthApi = new SwappyClient.OauthApi()
                oauthApi.getMe({}, (err, res, data) => {
                    if (err) {
                        return console.error(err)
                    }
                    console.log('Connected as', res.first_name, res.last_name)

                    this.uploadImages(() => {
                        console.log('done');
                    })
                })
            })
        },
        uploadImages(callback, index = 0) {
            if (index >= this.lines.length) {
                return callback();
            }
            let nextCallback = () => {
                    this.uploadImages(callback, index + 1);
                },
                line = this.lines[index];
            if (line.areImagesReady()) {
                return nextCallback();
            }
            this.selectLine({}, index, line);

            let images = [];

            for (let image of line.getJson().images) {
                let imagePath = path.join(this.baseDir, image),
                    stats = fs.lstatSync(imagePath);
                if (stats.isDirectory()) {
                    let filenames = fs.readdirSync(imagePath);
                    for (let filename of filenames) {
                        if (filename.substr(0, 1) !== '.') {
                            images.push(path.join(imagePath, filename));
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
            }else {
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