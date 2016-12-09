const {remote, ipcRenderer} = require('electron')
const csv = require('fast-csv')

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
        }
    }
})

ipcRenderer.on('open-file', () => {
    app.openDialog();
})