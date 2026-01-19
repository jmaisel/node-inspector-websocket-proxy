class Bus {
    constructor(name) {
        this.name = name;
    }
}

class BusGroup {
    static ORIENTATION = {
        'V': 1,
        'H': 2
    };

    constructor(name, orientation) {
        this.logger = new Logger('Busgroup:' + name);
        this.orientation = orientation || BusGroup.ORIENTATION.V;
        this.name = name;
    }

    clear() {
        this.items.forEach((v, i) => this.untag(i));
    }

    isTagged(idx) {
        let bus = this.getBus(idx);
        let $bus = $(bus.node);
        return $bus.attr('jsid') !== undefined && $bus.attr('logicalPin') !== undefined;
    }

    tag(row, component, mapping) {
        this.logger.info('tag', {jsid: component.jsid, row, mapping});

        if (!mapping) return;

        let bus = this.getBus(row);

        if(bus === undefined){
            throw 'No bus exists for row ' + row;
        }

        let $bus = $(bus.node);

        this.logger.debug('using bus', bus);

        if (this.isTagged(row)) {
            this.logger.info(`${$bus.attr('id')} is tagged by jsid ${$bus.attr('jsid')} logicalPin ${$bus.attr('logicalPin')}`);
            return;
        }

        // tag the bus on the breadboard in a uniform, easy to read way
        // by tagging the physical and logical pins, we can
        // read the circuit straight from the simulator while wiring things up
        let clone = Object.assign({}, mapping, {jsid:component.jsid, label:component.label});
        Breadboard.SVG_RECT_ATTRS.forEach(attr => $(bus.node).attr(attr, clone[attr]));

        bus.component = component;
    }

    untag(row) {
        let bus = this.getBus(row);
        let $bus = $(bus.node);

        if ($bus.attr('jsid') || $bus.attr('logicalPin')) {
            this.logger.info(`removing tag for ${$bus.attr('jsid')} at pin ${$bus.attr('logicalPin')}`);
            Breadboard.SVG_RECT_ATTRS.forEach((attr) => $bus.removeAttr(attr));
        }
    }

    render(ctx) {
        this.items = [];
        const item = this;

        if (item.orientation === BusGroup.ORIENTATION.H) {
            this.renderH(ctx, item);
        }
        else {
            this.renderV(ctx, item);
        }
    }

    getBus(idx) {
        return this.items[idx];
    }

    renderBus(ctx, item, i) {
        let x = ctx.cursor.x;
        let y = ctx.cursor.y + (ctx.padding / 2);
        let width = item.orientation === BusGroup.ORIENTATION.H ? ctx.busStrokePx : ctx.busColumnWidthPx;
        let height = item.orientation === BusGroup.ORIENTATION.H ? ctx.height - ctx.padding : ctx.busStrokePx;

        let rect = ctx.snap.rect(x, y, width, height);
        rect.attr({ idx: i, id: `${(this.name || item.constructor.name)}-${i}` });

        return rect;
    }

    renderH(ctx, item) {
        let count = (ctx.height - ctx.padding) / (ctx.busStrokePx + ctx.margin);

        if (item.voltages)
            count = item.voltages.length;

        for (let i = 0; i < count; i++) {
            let rect = this.renderBus(ctx, item, i);

            if(item.voltages)
                rect.attr('voltage', item.voltages[i]);

            this.items.push(rect);
            ctx.cursor.x += (ctx.busStrokePx + ctx.margin);
        }
    }

    renderV(ctx, item) {
        let count = (ctx.height - ctx.padding) / (ctx.busStrokePx + ctx.margin);

        for (let i = 0; i < count; i++) {
            let rect = this.renderBus(ctx, item, i);

            if(item.voltages)
                rect.attr('voltage', item.voltages[i]);

            this.items.push(rect);
            ctx.cursor.y += (ctx.busStrokePx + ctx.margin);
        }

        ctx.cursor.y = 0;
        ctx.cursor.x += ctx.busColumnWidthPx + ctx.margin;
    }
}

class Rails extends BusGroup {
    constructor(busdef, voltages, scale) {
        super(busdef, BusGroup.ORIENTATION.H, scale);
        this.voltages = [0, 3, 5];
    }
}

class Breadboard {

    static SVG_RECT_ATTRS = Object.freeze(['jsid', 'logicalPin', 'physicalPin', 'side', 'label', 'name', 'fill']);

    static filters = Object.freeze({
        logic: ['Logic', 'Logic Output', 'Logic Input']
    });

    constructor(svgId) {
        this.svgId = svgId;
        this.svg = $(this.svgId);
        this.snap = new Snap(this.svgId);

        this.rails = new Rails(new Bus('rails'));
        this.busgroup = new BusGroup(new Bus('left side'));
        this.busgroup1 = new BusGroup(new Bus('right side'));
        this.gpio = new BusGroup(new Bus('gpio'));

        this.busgroups = [this.rails, this.busgroup, this.busgroup1, this.gpio];

        this.logger = new Logger('Breadboard');
    }

    static ignore = (label) => Object.entries(Breadboard.filters).find(([k, v]) => v.indexOf(label) !== -1) !== undefined;

    static isRail(component) {
        if (!component) return false;
        try {
            let type = component.getType ? component.getType() : '';
            return type === 'VoltageElm' || type === 'GroundElm' || type.includes('Rail');
        } catch(e) {
            return false;
        }
    }

    static isGPIO(component) {
        if (!component) return false;
        try {
            let type = component.getType ? component.getType() : '';
            return type === 'GPIOInputElm' || type === 'GPIOOutputElm';
        } catch(e) {
            return false;
        }
    }

    static fill = (el)=>$(el).attr('fill', 'white');
    static unfill = (el)=>$(el).attr('fill');

    setCtx(ctx) {

        // sync changes in the circuit model here.
        if(!this.application){
            let that = this;
            ctx.simulator.watch({
                notify:(op, jsid)=>{
                    // that.syncToModel()
                    this.logger.info(`watching change:${op} for ${jsid}`);

                    switch(op){
                        case 'add':
                            this.overlay(this.application.simulator.findByJsid(jsid));
                            break;

                        case 'removeAll':
                            this.application.overlayController.clear();
                            break;

                        case 'remove':
                            // this.application.breadboard.remove(jsid);
                            // this.application.overlayController.remove(jsid);
                            this.remove(jsid);
                            break;
                    }

                }
            });

            // Subscribe to BOM updates
            ctx.sub('store:set', (eventName, data) => {
                if (data.key === 'bom') {
                    this.logger.info('BOM updated, syncing breadboard', data);
                    this.syncToModel(data.value);
                }
            });
        }

        this.logger.info('setCtx', ctx);
        this.clear();
        this.application = ctx;
        this.busgroups.forEach((item) => item.application = ctx);
    }

    render() {
        this.logger.info('render()');
        let margin = 4;
        let busStrokePx = 2;
        let padding = 20;
        let busColumnWidthPx = 114;
        let cursor = {
            x: margin,
            y: 0
        };
        let evt = {
            busColumnWidthPx: busColumnWidthPx,
            busStrokePx: busStrokePx,
            padding: padding,
            margin: margin,

            height: this.svg.height(),
            width: this.svg.width(),

            cursor: cursor,
            snap: this.snap,
            breadboard: this,
            offsetX: cursor.x + padding
        };

        this.renderRails(Object.assign(evt, {busGroup: 'rails'}));
        this.renderBank1(Object.assign(evt, {busGroup: 'left-bank'}));
        this.renderBank2(Object.assign(evt, {busGroup: 'right-bank'}));
        this.renderGPIO(Object.assign(evt, {busGroup: 'gpio'}));
    }

    renderRails(evt) {
        this.logger.info('renderRails', evt);
        evt.idx = 0;
        let rails = this.busgroups[evt.idx];
        rails.name = evt.busGroup;
        rails.render(evt);
    }

    renderBank1(evt) {
        this.logger.info('renderBank1', evt);
        evt.idx = 1;
        evt.cursor.x += evt.margin;
        let busses = this.busgroups[evt.idx];
        busses.name = evt.busGroup;
        busses.render(evt);
    }

    renderBank2(evt) {
        this.logger.info('renderBank2', evt);
        evt.idx = 2;
        evt.cursor.x += evt.margin;
        let busses = this.busgroups[evt.idx];
        busses.name = evt.busGroup;
        busses.render(evt);
    }

    renderGPIO(evt) {
        this.logger.info('renderGPIO', evt);
        evt.idx = 3;
        evt.cursor.x += evt.margin;
        let busses = this.busgroups[evt.idx];
        busses.name = evt.busGroup;
        busses.render(evt);
    }

    remove(jsid){
        this.logger.info(`removing ${jsid} from breadboard`);

        this.application.breadboard.svg
            .contents()
            .filter(`[jsid="${jsid}"]`)
            .each( (_, el) => Breadboard.SVG_RECT_ATTRS.forEach(attr => $(el).removeAttr(attr)) );

        // Check if this is a rail/GPIO component - if so, trigger re-sync
        try {
            let comp = CircuitModel.getComponent(jsid);
            if (comp && (Breadboard.isRail(comp) || Breadboard.isGPIO(comp))) {
                // Clear and re-sync after rail/GPIO removal
                this.rails.clear();
                this.gpio.clear();
                this.syncToModel();
            }
        } catch(e) {
            this.logger.debug('Error checking component type on remove', e);
        }
    }

    reset() {
        this.logger.info('reset()');

        if(this.application){
            this.application.breadboard.svg.find('[fill]').each((i, el)=>{
                $(el).removeAttr('fill');
            });
        }
    }

    clear() {
        this.logger.info('clear()');
        this.busgroup.clear();
        this.busgroup1.clear();
        this.gpio.clear();
        this.rails.clear();

        if(this.application){
            this.application.breadboard.svg.find('[jsid]').each((i, el)=>{
                Breadboard.SVG_RECT_ATTRS.forEach((attr) => $(el).removeAttr(attr));
            });
        }
    }

    highlightBus(jsid, logicalPin) {
        this.logger.info('highlightBus', { jsid, logicalPin });
        let bus = this.busFor(jsid, logicalPin);

        if (bus) {
            Breadboard.fill(bus);
        }
    }

    unhighlightBus(jsid, logicalPin) {
        this.logger.info('unhighlightBus', { jsid, logicalPin });
        let bus = this.busFor(jsid, logicalPin);

        if (bus) {
            $(bus).removeAttr('fill');
        }
    }

    highlightComponent(component) {
        let jsid = component.jsid;
        this.logger.info('highlightComponent', component.jsid);

        this.application.breadboard.svg.find(`[jsid="${component.jsid}"]`).each((i, el)=>{
            Breadboard.fill(el);
        });
    }

    unhighlightComponent(component) {
        let jsid = component.jsid;
        this.logger.info('unhighlightComponent', jsid);

        this.application.breadboard.svg.find(`[jsid="${jsid}"]`).each((i, el)=>{
            $(el).removeAttr('fill');
        });
    }

    highlightByAttr([k,v]) {
        this.logger.info('highlightByAttr', [k, v]);
        this.application.breadboard.svg.find(`[${k}="${v}"]`).each((i, el)=>{
            Breadboard.fill(el);
        });
    }

    unhighlightByAttr([k,v]) {
        this.logger.info('highlightByAttr', [k, v]);
        this.application.breadboard.svg.find(`[${k}="${v}"]`).each((i, el)=>{
            Breadboard.unfill(el);
        });
    }

    unhighlightByType(label) {
        this.logger.info('unhighlightByType', label);
        this.application.breadboard.svg.find(`[label="${label}"]`).each((i, el)=>{
            $(el).removeAttr('fill');
        });
    }

    unhighlightMapped(){
        this.logger.info('unhighlightMapped');
        this.application.breadboard.svg.find(`[fill]`).each((i, el)=>{
            $(el).removeAttr('fill');
        });
    }

    highlightMapped(){
        this.logger.info('highlightMapped');
        this.application.breadboard.svg.find(`[label]`).each((i, el)=>{
            Breadboard.fill(el);
        });
    }

    busFor(jsid, logicalPin) {
        this.logger.info('busFor', {jsid, logicalPin});

        const findIt = (bg) => {
            // return bg.items.filter(bus => bus.attr("jsid") === jsid && bus.attr("logicalPin") === String(logicalPin));

            let result = undefined;

            bg.items.forEach(v => {
                let bus = $(v.node);
                if (bus.attr('jsid') === jsid && bus.attr('logicalPin') === String(logicalPin)) {
                    result = bus;
                }
            });
            return result;
        };

        // Search in all bus groups: left bank, right bank, rails, and GPIO
        let lb = findIt(this.busgroup);
        let rb = findIt(this.busgroup1);
        let rails = findIt(this.rails);
        let gpio = findIt(this.gpio);

        return lb || rb || rails || gpio;
    }

    overlay(component){
        component.view = this.application.overlayController.overlayComponent(component.jsid, null, 12, null);
        component.view.fadeOut();
    }

    syncToModel() {
        this.logger.info('syncToModel');

        this.application.overlayController.clear();
        Object.values(this.application.circuitModel.getComponents()).forEach((c)=>this.overlay(c));

        const assignSimpleComponent = (component, row) => {

            // required by Breadboard.tag();
            component.pins = [{logicalPin:0, name:'V'}, {logicalPin:1, name:'G'}];

            this.logger.info('assigning simple component pins', { component });
            for (let i = 0; i < component.pins.length; i++) {
                let mapping = component.pins[i];
                let bank = i % 2 === 0 ? this.busgroup : this.busgroup1;
                bank.tag(row, component, mapping);
                row += i % 2 === 0 ? 0 : 1;
            }

            return component.pins.length;
        };

        const assignComplexComponent = (component, row) => {
            this.logger.info(`placing complex component ${component.jsid}`, { component });

            // Check if component has pinProfile from hardware profile
            if (!component.pinProfile) {
                const errorMsg = `FATAL: Component "${component.label}" (${component.jsid}) is missing pinProfile. This component cannot be laid out on the breadboard. Check that hardware-profile.json has an entry for "${component.label}".`;
                this.logger.error(errorMsg);
                throw new Error(errorMsg);
            }

            // Balance pins using the CircuitModel's balancePins method
            const { left, right } = CircuitModel.balancePins(component.pinProfile.pins);
            let totalRows = Math.max(left.length, right.length);

            for (let i = 0; i < totalRows; i++) {
                if (left[i]) {
                    this.busgroup.tag(row, component, left[i]);
                }
                if (right[i]) {
                    this.busgroup1.tag(row, component, right[i]);
                }
                row++;
            }

            return totalRows;
        };

        const assignRail = (component) => {
            this.logger.info('assigning rail component', { component });

            // Determine voltage
            let voltage = 5; // Default
            try {
                let type = component.getType ? component.getType() : '';
                if (type === 'GroundElm') {
                    voltage = 0;
                } else if (component.getVoltage) {
                    voltage = component.getVoltage();
                }
            } catch(e) {
                this.logger.debug('Error getting voltage, using default', e);
            }

            // Find matching rail index
            let railIndex = this.rails.voltages.indexOf(voltage);
            if (railIndex !== -1 && !this.rails.isTagged(railIndex)) {
                this.rails.tag(railIndex, {
                    jsid: component.jsid,
                    label: component.label || CircuitModel.labelForJsid(component.jsid)
                }, {
                    logicalPin: 0,
                    physicalPin: 0,
                    name: `${voltage}V`
                });
            }

            return 0; // Don't increment cursor for rails
        };

        const assignGPIO = (component) => {
            this.logger.info('assigning GPIO component', { component });

            // Get GPIO properties
            let props = null;
            try {
                if (component.getGPIOProperties) {
                    props = component.getGPIOProperties();
                }
            } catch(e) {
                this.logger.debug('Error getting GPIO properties', e);
            }

            if (props && props.bcmPinNumber >= 0 && props.bcmPinNumber < this.gpio.items.length && !this.gpio.isTagged(props.bcmPinNumber)) {
                this.gpio.tag(props.bcmPinNumber, {
                    jsid: component.jsid,
                    label: component.label || CircuitModel.labelForJsid(component.jsid)
                }, {
                    logicalPin: 0,
                    physicalPin: props.bcmPinNumber,
                    name: props.pinName || `GPIO${props.bcmPinNumber}`
                });

                this.logger.info('Tagged GPIO bus', { bcmPin: props.bcmPinNumber, pinName: props.pinName });
            }

            return 0; // Don't increment cursor for GPIO
        };

        let cursor = 0;
        let bom = this.application.circuitModel.asBOM();

        this.logger.info('syncToModel bom:', bom);

        [...bom.lineItems.values()]
            .forEach(lineItem => {

                if (lineItem.jsids) {
                    lineItem.jsids.forEach(jsid => {
                        const component = this.application.circuitModel.getComponent(jsid);

                        let li = bom.itemByJsid(jsid);

                        // Set the pin manager mapping on the component
                        this.logger.info('\tsyncToModel lineItem:', li);

                        // Route component to appropriate assignment method
                        if (Breadboard.isRail(component)) {
                            this.logger.info('Placing rail component', jsid);
                            assignRail(component);
                        }
                        else if (Breadboard.isGPIO(component)) {
                            this.logger.info('Placing GPIO component', jsid);
                            assignGPIO(component);
                        }
                        else if(Breadboard.ignore(CircuitModel.labelForJsid(jsid))){
                            this.logger.info('Ignoring placement on breadboard for', jsid);
                        }
                        else if(CircuitModel.isSimpleComponent(component)) {
                            this.logger.info('Placing simple component', jsid);
                            cursor += assignSimpleComponent(component, cursor);
                        }
                        else {
                            this.logger.info('Placing complex component', jsid);
                            cursor += assignComplexComponent(component, cursor);
                        }
                    });
                }
            });

        this.logger.info('layoutComponents completed', { cursor });
    }

    show(){
        $('#breadboard-pane').fadeIn();
    }

    hide(){
        $('#breadboard-pane').fadeOut();
    }
}


