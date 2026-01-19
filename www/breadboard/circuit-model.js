class CircuitModel{

    constructor(application) {
        // set a static reference to the application
        CircuitModel.application = application;
        this.application = application;

        this.logger = new Logger("CircuitModel");
        CircuitModel.logger = this.logger;

        CircuitModel.setProfile("/breadboard/hardware-profile.json");
        this.profile = CircuitModel.profile;

        // this.application.simulator.oncircuitread()
    }

    static setProfile(uri){
        // load the hardware profile that maps logical to physical pins
        // this.logger.debug("fetching hardware profile");
        let that = CircuitModel;

        $.ajax({
            url: uri,
            type: "GET",
            async: false,
            success: function(data) {
                that.logger.debug("hardware profile loaded", uri, data);

                if(typeof(data) === "string"){
                    data = JSON.parse(data);
                }
                that.profile = data;
            }
        });
    }

    simplify(){
        this.logger.debug(`simplify()`);
        const simulatorModel = this.application.simulator.buildComponentMapping().connections;
        const scanner = new CircuitScanner(simulatorModel);
        const result = scanner.dictionary()
        this.logger.debug("simplify():", result);
        return result;
    }

    getComponents() {
        this.logger.debug(".getComponents()");

        const mapping = this.application.simulator.buildComponentMapping();
        let result = {}

        Object.values(mapping.components)
            // .filter(c => !c.label)
            .filter(c => c.getType().indexOf("Wire") === -1)
            .forEach(c => {
                result[c.jsid] = c;
                c.label = CircuitModel.labelForJsid(c.jsid);

                if(CircuitModel.isSimpleComponent(c))
                    return;

                const p = this.profile[c.label];

                if(!p){
                    this.logger.warn(`Component ${c.label} doesn't exist in the hardware profile`)
                    return;
                }

                const mid = Object.values(p.pins).length / 2;
                const pins = Object.values(p.pins);
                this.logger.info(`profile ${c.label}:`, p, pins);

                c.pinProfile = {
                    manufacturer : p.manufacturer || "Unknown",
                    model : p.sku || "Unknown",
                    banks : { left:  [], right: [] },
                    pins : []
                }

                const lbank = pins.slice(0, mid);
                const rbank = pins.slice(mid);

                [rbank, lbank].forEach(bank => {
                    let b = bank === rbank?"right":"left";

                    bank.forEach((pin, idx) => {
                        const map = {
                            idx: idx,
                            name: pin.logical === -1?"X":CircuitModel.labelForPin(c, pin.physical),
                            side: b,
                            logicalPin: pin.logical,
                            physicalPin: pin.physical
                        }

                        c.pinProfile.pins.push(map);
                        c.pinProfile.banks[b].push(map);
                    })
                })
            });

        this.logger.debug(`getComponents returning`, result);

        return result;
    }

    getComplexComponents(){
        return Object.values(this.getComponents()).filter(c => !CircuitModel.isSimpleComponent(c))
    }

    getComponent(jsid){
        return CircuitModel.getComponent(jsid);
    }

    static getComponent(jsid){
        return this.application.simulator.findByJsid(jsid);
    }

    asBOM(){
        this.logger.info(".asBOM", this.application.store.get("bomMapping"));
        let result = this.application.store.get("bomMapping") || new BillOfMaterials(this.application);
        this.application.store.set("bomMapping", result);
        return result;
    }

    static encodeToken(c, pin){
        CircuitModel.application.circuitModel.logger.debug("encodeToken", {c, pin});

        if(!c.getPinNames){
            CircuitModel.application.circuitModel.logger.debug(c, `is not a component; fetching`)
            c = CircuitModel.application.simulator.buildComponentMapping().components[c]
        }

        let pinName = c.isChip() && c.getPinNames()[pin]?CircuitModel.PIN_NAME_DELIMITER+c.getPinNames()[pin]:"?";
        let obj = {jsid: c.jsid, logicalPin: pin, pinName:pinName};

        return JSON.stringify(obj);
    }

    encodeToken(c, pin){
        const result = CircuitModel.encodeToken(c, pin);
        this.logger.debug("returning", result);
        return result;
    }

    static decodeToken(token){

        CircuitModel.application.circuitModel.logger.debug('decodeToken', token);
        let t = JSON.parse(token);
        t.component = CircuitModel.application.simulator.buildComponentMapping().components[t.jsid];
        return t;
    }

    decodeToken(t){
        this.logger.debug(`.decodeToken(${t})`);
        return CircuitModel.decodeToken(t);
    }

    static containsOnlySimpleComponents(components) {
        let result = true;

        Object
            .values(components)
            .filter(comp => !PinManagerUtil.instance().ignore(comp.jsid))
            .forEach(component => result = result && CircuitModel.isSimpleComponent(component));

        CircuitModel.application.circuitModel.logger.debug('containsOnlySimpleComponents', {components}, `returning ${result}`);
        return result;
    }

    static requiresPinMapping(circuitModel){
        return !CircuitModel.containsOnlySimpleComponents(circuitModel.getComponents()) && this.application.store.has("bomMapping");
    }

    static labelForJsid(jsid){
        return jsid.replace(/Elm.*/, '').replace(/([A-Z])/g, ' $1').trim();
    }

    static fullLabelForJsid(jsid){
        return CircuitModel.labelForJsid(jsid) + LineItem.sublabel(CircuitModel.application.circuitModel.getComponent(jsid));
    }

    static isSimpleComponent (component){
        CircuitModel.application.circuitModel.logger.debug("isSimpleComponent", component.jsid);
        const c = (comp)=> comp.getPostCount() <= 2;

        if(component.getPostCount){
            return c(component);
        }

        return c(CircuitModel.application.circuitModel.getComponent(component.jsid));
    };

    static isComplexComponent(compoent){
        return !CircuitModel.isSimpleComponent(compoent);
    }

    static labelForPin(component, physicalPinNbr){

        let err = false;

        if(physicalPinNbr === -1)
            return "X"

        let profile = CircuitModel.profile[component.label]

        CircuitModel.logger.info(`labelForPin ${component.label} loaded profile`, profile);

        return profile.pins[physicalPinNbr].name;

        // if(profile.source === "Chip"){
        //     component.getPinNames()[logicalPinNbr] || "unknown";
        // }
        // else{
        //
        // }

        // if(component.getPinNames){
        //     try{
        //         return component.getPinNames()[logicalPinNbr] || "unknown";
        //     }
        //     catch(e){
        //         err = true;
        //         console.info(component.label, e)
        //     }
        // }
        //
        // if(err){
        //     console.log("glerp", component.label, CircuitModel.profile[component.label].pins)
        //     return Object
        //         .values(CircuitModel.profile[component.label].pins)
        //         .find(value => value.physical === logicalPinNbr).name
        // }
    }

    static balancePins(pins) {
        const leftPins = pins.filter(pin => pin.side === 'left').sort((a, b) => a.physicalPin - b.physicalPin);
        const rightPins = pins.filter(pin => pin.side === 'right').sort((a, b) => a.physicalPin - b.physicalPin);

        const totalPins = Math.max(leftPins.length, rightPins.length) * 2;

        while (leftPins.length < totalPins / 2) {
            leftPins.push({ name: "X", logicalPin: "null", physicalPin: leftPins.length + 1, side: "left" });
        }

        while (rightPins.length < totalPins / 2) {
            rightPins.push({ name: "X", logicalPin: "null", physicalPin: totalPins - rightPins.length, side: "right" });
        }

        leftPins.sort((a, b) => a.physicalPin - b.physicalPin);
        rightPins.sort((a, b) => b.physicalPin - a.physicalPin);

        return { left: leftPins, right: rightPins };
    }

    static getCharacteristics = (jsid)=>{
        this.logger.debug("getCharateristics", jsid);

        let label = CircuitModel.fullLabelForJsid(jsid);
        let comp = CircuitModel.getComponent(jsid);
        let info = comp.getInfo().toString().split(",");

        // this.logger.debug("getCharacteristics", {jsid, label, info});

        switch(label){
        case "Resistor":
            return info[3];

        case "Switch":
            return info[0]
        }

        return label;
    }
}

