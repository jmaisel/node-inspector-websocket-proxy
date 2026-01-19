class BillOfMaterials{
    constructor(application) {
        this.logger = new Logger('BillOfMaterials', Logger.LEVEL.DEBUG);
        this.application = application;
        this.lineItems = new Map();
        this.dictionary = new Map();

        Object
            .values(this.application.circuitModel.getComponents())
            .forEach(c => this.add(new LineItem(c)));

        this.logger.debug('created BillOfMaterials', this);
    }

    static filters = Object.freeze({
        logic: ['Logic', 'Logic Output', 'Logic Input', 'Output'],
        power: ['Voltage', 'Ground', 'Rail'],
        passive: ['Wire']
    });

    static ignore = (label) => Object.entries(BillOfMaterials.filters).find(([k, v]) => v.indexOf(label) !== -1) !== undefined;
    add(item){

        this.logger.debug('.add', item.label, item);

        if(!item.label){
            item.label = CircuitModel.labelForJsid(item.jsid);
            item.sublabel = LineItem.sublabel(item);
            item.fullLabel = item.label + item.sublabel;
        }

        if(BillOfMaterials.ignore(item.label)){
            this.logger.debug(`ignoring ${item.label}.  nothing to add.`);
            return;
        }

        if(this.lineItems.has(item.fullLabel)){
            const existingItem = this.lineItems.get(item.fullLabel);
            existingItem.jsids.push(item.example);
            existingItem.quantity++;
        }
        else{
            this.lineItems.set(item.fullLabel, item);

            let clone = Object.assign({}, item);
            delete clone.quantity;
            this.dictionary.set(item.fullLabel, clone);
            this.dictionary.set(item.example, clone);
        }

        this.logger.debug('.add done', 'this.dictionary=', this.dictionary);
    }

    remove(jsid){

        this.logger.debug('.remove', jsid);
        let label = CircuitModel.fullLabelForJsid(jsid);

        if(BillOfMaterials.ignore(label)){
            this.logger.debug(`ignoring ${label}.  nothing to remove.`);
            return;
        }

        if(this.lineItems.has(label)){
            const existingItem = this.lineItems.get(label);
            existingItem.jsids.removeByValue(jsid);
            existingItem.quantity--;

            if(existingItem.quantity === 0){
                this.lineItems.delete(label);
            }
        }
        else{
            this.logger.warn('remove called, but no jsid', jsid);
        }
    }

    clear(){
        this.logger.info('clear()');
        this.lineItems.clear();
    }

    itemByLabel(fullLabel){
        return this.lineItems.get(fullLabel);
    }

    itemByJsid(jsid){
        return this.itemByLabel(CircuitModel.fullLabelForJsid(jsid));
    }

    isMapped(jsid){
        this.logger.debug('isMapped: ' + jsid);
        let label = CircuitModel.fullLabelForJsid(jsid);
        return this.lineItems.has(label) && this.lineItems.get(label).mapping !== undefined;
    }
}
