class Line {
    constructor(data) {
        let defaults = {
            auction: false
        }
        for (let head of Line.getHeaders()) {
            this[head] = data[head] || (typeof defaults[head] !== 'undefined' ? defaults[head] : '')
            if (this.getInputType(head) == 'number') {
                this[head] = this[head].replace(/[^0-9.]/g, '');
            }
            if (this.getInputType(head) == 'checkbox') {
                this[head] = this[head] === 'false' ? false : !!this[head];
            }
            if (this.getInputType(head) == 'textarea') {
                if (!this[head].match(/<[^>]+><\/[^>]+>/)) {
                    this[head] = this[head].replace(/\n/g, '<br>');
                }
            }
        }
        this.selected = false
        this.errors = [];
    }

    static cleanPrice(price) {
        if (typeof price !== 'string') {
            return price
        }
        price = price.replace(/,/, '.')
        price = price.replace(/[^0-9\.]/g, '')

        return price
    }

    static getHeaders() {
        return [
            'id',
            'category',
            'title',
            'description',
            'auction',
            'price',
            'reserve_price',
            'quantity',
            'duration',
            'auto_renew',
            'accept_offers',
            'accept_offers_over',
            'refuse_offers_under',
            'delivery',
            'address',
            'payment',
            'paypal_email',
            'charge_taxes',
            'charge_taxes_shipping',
            'images',
            'option_titlecolor',
            'option_first',
            'option_frame',
        ]
    }

    getInputType(header) {
        switch (header) {
            case 'price':
            case 'address':
            case 'reserve_price':
            case 'accept_offers_over':
            case 'refuse_offers_under':
                return 'number';
            case 'option_titlecolor':
            case 'option_first':
            case 'option_frame':
            case 'auction':
            case 'auto_renew':
            case 'accept_offers':
            case 'charge_taxes':
            case 'charge_taxes_shipping':
                return 'checkbox';
            case 'description':
                return 'textarea';
            default:
                return 'text';
        }
    }

    areImagesReady() {
        let images = this.getJson().images
        if (!images) {
            return true
        }
        for (let image of images) {
            if (!image.url.match(/^https?:\/\//)) {
                return false
            }
        }
        return true
    }

    getJson() {
        let json = {}

        //Prices
        json['price'] = Line.cleanPrice(this.price)
        json['reserve_price'] = Line.cleanPrice(this.reserve_price)

        //Category
        if (this.category) {
            let parts = /^.*\/(\d+)-[^/]+$/.exec(this.category);
            let category = Number.parseInt(parts[1])
            if (!Number.isNaN(category)) {
                json.category = {
                    id: category
                }
            } else {
                console.error('Invalid Category ID', this.category)
            }
        }

        //Payment
        if (this.payment) {
            json.payment = []
            for (let id of this.payment.split('|')) {
                if (id == 4 && this.paypal_email) {
                    json.payment.push({
                        'id': id,
                        'user_info': this.paypal_email
                    })
                } else {
                    json.payment.push({
                        'id': id
                    })
                }
            }
        }

        //Deliveries
        if (this.delivery) {
            json.delivery = []
            for (let info of this.delivery.split('|')) {
                let parts = info.split(':')
                json.delivery.push({
                    'id': Number.parseInt(parts[0]),
                    'cost': parts[1]
                })
            }
        }

        //Address
        if (this.address) {
            json.address = {
                id: Number.parseInt(this.address)
            }
        }

        //Estimates
        if (this.estimate_min) {
            json.estimate = {
                min: this.estimate_min
            }
        }
        if (this.estimate_max) {
            json.estimate = json.estimate || {}
            json.estimate.max = this.estimate_max
        }

        //Options
        for (let header of Line.getHeaders()) {
            if (header.substr(0, 7) == 'option_' && this[header]) {
                json.options = json.options || {}
                json.options[header.substr(7)] = this[header]
            }
        }

        //Offers
        if (this.accept_offers) {
            json.offer = {
                enabled: !!this.accept_offers
            }
            if (this.accept_offers_over) {
                json.offer.accept_over = this.accept_offers_over
            }
            if (this.refuse_offers_under) {
                json.offer.refuse_under = this.refuse_offers_under
            }
        }

        //Taxes
        if (this.charge_taxes) {
            json.taxes = {
                charge: !!this.charge_taxes
            }
            if (typeof this.charge_taxes_shipping) {
                json.taxes.include_shipping = !!this.charge_taxes_shipping
            }
        }

        //Images
        if (this.images) {
            let urls = this.images.split('|');
            json.images = []
            for (let url of urls) {
                json.images.push({
                    url: url
                })
            }
        }

        let ignoreHeaders = [
            'id',
            'images',
            'price',
            'reserve_price',
            'category',
            'payment',
            'delivery',
            'address',
            'estimate_min',
            'option_titlecolor',
            'option_first',
            'option_frame',
            'accept_offers',
            'accept_offers_over',
            'refuse_offers_under',
            'charge_taxes',
            'charge_taxes_shipping',
            'paypal_email',
        ]

        for (let header of Line.getHeaders()) {
            if (this[header] !== '' && ignoreHeaders.indexOf(header) === -1) {
                json[header] = this[header]
            }
        }

        return json
    }

    getCssClasses() {
        return {
            selected: this.selected,
            ready: this.areImagesReady(),
            error: this.errors.length > 0
        }
    }

    getStatusText() {
        if (!this.areImagesReady()) {
            return 'New (local images)'
        }
        if (!this.id) {
            return 'New (images ready)'
        }

        return 'Done'
    }

    getErrorText(error) {
        switch (error.code) {
            case "unknown_field":
                return "This field should not have been sent, please fill in a bug report"
            case "missing_field":
                return "This field is required"
            case "not_found":
                return "Invalid ID"
            case "already_exists":
                return "Add seems to be a duplicate"
            case "invalid":
                return error.message
        }
    }
}

module.exports = Line