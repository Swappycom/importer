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
        authenticate(callback) {
            let authUrl = "https://api.swappy.com/oauth2/authorize?response_type=token&redirect_uri=https%3A%2F%2Fapi.swappy.com%2Foauth2%2Flogin_success&realm=Service&client_id=swapster&scope=addresses+sell+email&state=",
                state = Math.random();

            let win = new remote.BrowserWindow({
                parent: remote.getCurrentWindow(),
                modal: true,
                width: 600,
                height: 600
            })

            win.loadURL(authUrl + state)
            win.webContents.on('did-get-response-details', (event, status, newURL) => {
                if (String(newURL).match(/^https:\/\/api\.swappy\.com\/oauth2\/login_success/)) {
                    let parts = url.parse('?' + url.parse(newURL).hash.substr(1), true)
                    win.close()
                    if (parts.query.access_token) {
                        this.access_token = parts.query.access_token
                        if (callback) {
                            callback(this.access_token);
                        }
                    } else {
                        alert('Error getting access token')
                    }
                }
            });

        }
    }
})