class Line {
    constructor(data) {
        let defaults = {
            auction: false
        }
        for (let head of Line.getHeaders()) {
            this[head] = data[head] || (typeof defaults[head] !== 'undefined' ? defaults[head] : '')
        }
        this.selected = false;
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

    areImagesReady() {
        let images = this.getJson().images;
        if(!images) {
            return true;
        }
        for(let image of images) {
            if(!image.match(/^https?:\/\//)) {
                return false;
            }
        }
        return true;
    }

    getJson() {
        let json = {}

        //Prices
        json['price'] = Line.cleanPrice(this.price)
        json['reserve_price'] = Line.cleanPrice(this.reserve_price)

        //Category
        if (this.category) {
            let category = this.category.split('/')
            category = category[category.length - 1]
            category = category.replace(/[^0-9]+/g, '');
            category = Number.parseInt(category);
            if (!Number.isNaN(category)) {
                json.category = {
                    id: this.category
                }
            } else {
                console.error('Invalid Category ID', this.category);
            }
        }

        //Payment
        if (this.payment) {
            json.payment = [];
            for (let id of this.payment.split('|')) {
                json.payment.push({
                    'id': id
                });
            }
        }

        //Deliveries
        if (this.delivery) {
            json.delivery = [];
            for (let info of this.delivery.split('|')) {
                let parts = info.split(':');
                json.delivery.push({
                    'id': parts[0],
                    'cost': parts[1]
                });
            }
        }

        //Address
        if (this.address) {
            json.address = {
                id: this.address
            }
        }

        //Estimates
        if (this.estimate_min) {
            json.estimate = {
                min: this.estimate_min
            }
        }
        if (this.estimate_max) {
            json.estimate = json.estimate || {};
            json.estimate.max = this.estimate_max;
        }

        //Options
        for (let header of Line.getHeaders()) {
            if (header.substr(0, 7) == 'option_' && this[header]) {
                json.options = json.options || {};
                json.options[header.substr(7)] = this[header];
            }
        }

        //Offers
        if (this.accept_offers) {
            json.offer = {
                accept: !!this.accept_offers
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
            json.images = this.images.split('|');
        }

        return json
    }

    getCssClasses() {
        return {
            selected: this.selected,
            ready: this.areImagesReady()
        }
    }
}

module.exports = Line;