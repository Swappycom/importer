const {remote} = require('electron')
const csv = require('fast-csv')
const swappy = require('swappy-client')
const url = require('url')

const app = new Vue({
    el: '#app',
    data: {
        headers: [
            'category',
            'title',
            'description',
            'price',
            'quantity',
            'duration',
            'auto_renew',
            'accept_offers',
            'delivery',
            'payment',
            'paypal_email',
            'charge_taxes',
            'images'
        ],
        lines: []
    },
    methods: {
        pushLine(data) {
            let line = {};
            for (let head of this.headers) {
                line[head] = data[head] || ''
            }
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
                this.lines = [];
                csv
                    .fromPath(file[0], {
                        headers: true
                    })
                    .on("data", (data) => {
                        this.pushLine(data);
                    })
            }
        },
        sendLines() {
            this.getClient((SwappyClient) => {
                console.log('Api loaded', SwappyClient);
                let oauthApi = new SwappyClient.OauthApi();
                oauthApi.getMe({}, (err, res, data) => {
                    if (err) {
                        return console.error(err);
                    }
                    console.log('Connected as', res.first_name, res.last_name);

                });
            });
        },
        getClient(callback) {
            this.authenticate((err, token) => {
                if(err) {
                    return console.error(err);
                }
                let SwappyClient = require('swappy-client'),
                    defaultClient = SwappyClient.ApiClient.instance;
                defaultClient.authentications.oauth.accessToken = token;

                callback(SwappyClient);
            });
        },
        authenticate(callback) {
            if (this.access_token) {
                callback(null, this.access_token);
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
            win.webContents.openDevTools({
                mode: 'detach'
            })

            win.loadURL(authUrl + state)
            win.webContents.on('did-get-response-details', (event, status, newURL) => {
                if (String(newURL).match(/^https:\/\/api\.swappy\.com\/oauth2\/login_success/)) {
                    let parts = url.parse('?' + url.parse(newURL).hash.substr(1), true)
                    win.close()
                    if (parts.query.access_token) {
                        this.access_token = parts.query.access_token
                        callback(null, this.access_token);
                    } else {
                        callback('Error getting access token', null)
                    }
                }
            });

        }
    }
})