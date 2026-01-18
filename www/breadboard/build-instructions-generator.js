class BuildStep{

    static TYPE = {
        INFORMATIONAL: "informational",
        PLACE_COMPONENT: "place_component",
        CONNECT_COMPONENT: "connect_component"
    }

    constructor(text, type = BuildStep.TYPE.INFORMATIONAL, src, dest){
        this.text = text;
        this.type = type;
        this.src = src;
        this.dest = dest;
    }
}

class BomBasedBuildInstructions{
    constructor(application){
        this.logger = new Logger(this.constructor.name);
        this.application = application;

        this.logger.debug("new BomBasedBuildInstructions", {application});
    }

    // Helper to get user-friendly labels for power/ground/GPIO components
    getFriendlyLabel(jsid) {
        const component = CircuitModel.getComponent(jsid);
        if (!component) {
            return CircuitModel.fullLabelForJsid(jsid);
        }

        // Check component type
        let type = '';
        try {
            type = component.getType ? component.getType() : '';
        } catch(e) {
            // Fallback to jsid checking
            type = jsid;
        }

        // Handle voltage sources
        if (type === 'VoltageElm' || type.includes('Voltage') || jsid.includes('Voltage') || jsid.includes('Rail')) {
            try {
                let voltage = 5; // default

                // Try getVoltageDText
                if (component.getVoltageDText) {
                    voltage = component.getVoltageDText();
                }
                // Try getInfo
                else if (component.getInfo) {
                    let info = component.getInfo();
                    if (info && info.length > 1) {
                        voltage = info[1];
                    }
                }

                return `the ${voltage} Power Rail (on the left side of the breadboard)`;
            } catch(e) {
                return 'the Power Rail (on the left side of the breadboard)';
            }
        }

        // Handle ground
        if (type === 'GroundElm' || jsid.includes('Ground')) {
            return 'the Ground Rail (marked "G" on the left side of the breadboard)';
        }

        // Handle GPIO/Logic
        if (type === 'LogicInputElm' || type === 'LogicOutputElm' || type === 'OutputElm' ||
            jsid.includes('Logic Input') || jsid.includes('Logic Output') || jsid.includes('Output')) {
            return 'the GPIO pin (on the right side of the breadboard)';
        }

        return CircuitModel.fullLabelForJsid(jsid);
    }

    // #forLineItemComponentPins(lineItem, jsid){
    //     let pins = lineItem.mapping?lineItem.mapping.pins:[];
    //
    //     // set up pins for simple components, otherwise they come from the mapping
    //     if(CircuitModel.isSimpleComponent(CircuitModel.getComponent(jsid))){
    //         [1, 2].forEach(i=>{pins.push({physicalPin: i});});
    //     }
    //
    //     pins.forEach(pin => {
    //         let criteria = {comp: jsid, pin: pin.physicalPin-1};
    //
    //         [...this.wiring]
    //             .filter(([k, v])=>k.pin === criteria.pin && k.comp === criteria.comp)
    //             .forEach(([k, v])=> {
    //
    //                 let srcLabel = CircuitModel.fullLabelForJsid(k.comp);
    //                 let srcPin = k.pin;
    //
    //                 v.forEach(v=>{
    //                     let destLabel = CircuitModel.fullLabelForJsid(v.comp);
    //                     let destPin = v.pin;
    //                     let msg = `Connect pin ${srcPin+1} of the ${srcLabel} to pin ${destPin+1} of the ${destLabel}`;
    //                     let step = new BuildStep(msg, BuildStep.TYPE.CONNECT_COMPONENT, criteria, v);
    //
    //                     if(!this.trackit.has(msg)){
    //                         this.wiringSteps.push(step);
    //                         this.trackit.add(msg);
    //                     }
    //                 });
    //             });
    //     });
    // }
    //
    // #forLineItemComponents(lineItem, parentEl){
    //     $(".line-item-component", parentEl).each((i, el)=>{
    //         let jsid = $(el).attr("jsid");
    //         this.#forLineItemComponentPins(lineItem, jsid);
    //     });
    // }
    //
    // #forLineItems(){
    //     $(".bom-line-item").each((i, el1)=>{
    //
    //         let example = $(el1).attr("example");
    //         let title = CircuitModel.fullLabelForJsid(example);
    //         let lineItem = this.bom.lineItems.get(title);
    //
    //         let compMsg = `Place each ${lineItem.label} on the breadboard`;
    //         this.instructions.push(new BuildStep(compMsg));
    //
    //         $(".line-item-component", el1).each((i, el)=>{
    //             console.log("HERE", el);
    //             // this.#forLineItemComponents(lineItem, el);
    //         });
    //     });
    // }

    generate(){
        this.logger.info("generate");

        let instructions = [
            new BuildStep('First, we will place the components on the breadboard.'),
            new BuildStep('Note: The breadboard has power rails on the left (5V, 3V, and Ground) and GPIO pins on the right.')
        ];
        let trackit = new Set();
        let bom = this.application.circuitModel.asBOM();
        let wiring = this.application.circuitModel.simplify();
        let wiringSteps = [new BuildStep('Now we will connect the components with wires.')]

        // Track connected components to create a minimal spanning tree
        // unionFind maps each pin to its root pin
        let unionFind = new Map();
        let getRoot = (pin) => {
            if (!unionFind.has(pin)) {
                unionFind.set(pin, pin);
                return pin;
            }
            if (unionFind.get(pin) === pin) {
                return pin;
            }
            // Path compression
            let root = getRoot(unionFind.get(pin));
            unionFind.set(pin, root);
            return root;
        };
        let union = (pin1, pin2) => {
            let root1 = getRoot(pin1);
            let root2 = getRoot(pin2);
            if (root1 !== root2) {
                unionFind.set(root2, root1);
                return true; // Successfully joined two separate components
            }
            return false; // Already connected
        };

        this.logger.info("BOM has", bom.lineItems.size, "line items");
        this.logger.info("Wiring has", wiring.size, "connections");

        // first place all the components on the breadboard
        // Iterate over the BOM data model, not DOM elements
        for (let [fullLabel, lineItem] of bom.lineItems) {
            this.logger.debug("Processing line item:", fullLabel, lineItem);

            let compMsg = `Place each ${lineItem.label} on the breadboard`;
            instructions.push(new BuildStep(compMsg));

            // Iterate over each component instance in this line item
            lineItem.jsids.forEach(jsid => {
                this.logger.debug("Processing component:", jsid);

                compMsg = `Place the ${lineItem.fullLabel} ${CircuitModel.getCharacteristics(jsid)} on the breadboard`;
                instructions.push(new BuildStep(compMsg, BuildStep.TYPE.PLACE_COMPONENT, {comp: jsid}));

                // Get all pins for this component
                let component = CircuitModel.getComponent(jsid);
                let pins = [];

                if(CircuitModel.isSimpleComponent(component)){
                    // Simple components: 2 pins
                    [1, 2].forEach(i=>{pins.push({physicalPin: i});});
                } else {
                    // Complex components: iterate through all pins based on post count
                    let postCount = component.getPostCount ? component.getPostCount() : 2;
                    for(let i = 0; i < postCount; i++){
                        pins.push({physicalPin: i + 1});
                    }
                }

                this.logger.debug("Component has", pins.length, "pins");

                pins.forEach(pin => {
                    let criteria = {comp: jsid, pin: pin.physicalPin-1};

                    [...wiring]
                        .filter(([k, v])=>k.pin === criteria.pin && k.comp === criteria.comp)
                        .forEach(([k, v])=> {
                            let pinMsg = (simple, name, label)=>simple?`pin ${name} of the ${label}`:`the "${name}" pin of the ${label}`;

                            let srcCmp = CircuitModel.getComponent(k.comp);
                            let srcSimple = CircuitModel.isSimpleComponent(srcCmp);
                            let srcLabel = CircuitModel.fullLabelForJsid(k.comp);

                            // Safely get pin name - some components throw IllegalArgumentException
                            let srcName;
                            if (srcSimple) {
                                srcName = k.pin + 1;
                            } else {
                                try {
                                    if (srcCmp.getPinNames) {
                                        const pinNames = srcCmp.getPinNames();
                                        srcName = pinNames ? pinNames[k.pin] : k.pin + 1;
                                    } else {
                                        srcName = k.pin + 1;
                                    }
                                } catch (e) {
                                    // Component doesn't support getPinNames() - use pin number
                                    srcName = k.pin + 1;
                                }
                            }
                            let srcMsg = pinMsg(srcSimple, srcName, srcLabel);

                            v.forEach(v=>{
                                let destJsid = v.comp;
                                let destCmp = CircuitModel.getComponent(v.comp);

                                // Create keys for union-find
                                let key1 = `${k.comp}:${k.pin}`;
                                let key2 = `${v.comp}:${v.pin}`;

                                // Only generate instruction if this joins two separate components
                                // This creates a minimal spanning tree
                                if(!union(key1, key2)){
                                    return; // Already connected via another path
                                }

                                // Use friendly labels for power/ground/GPIO, regular labels for components
                                let destLabel = this.getFriendlyLabel(destJsid);
                                let destSimple = CircuitModel.isSimpleComponent(destCmp);

                                // Check if destination is a rail or GPIO
                                let destType = '';
                                try {
                                    destType = destCmp.getType ? destCmp.getType() : '';
                                } catch(e) {
                                    destType = destJsid;
                                }

                                let isRailOrGPIO = destType === 'VoltageElm' || destType === 'GroundElm' ||
                                                   destType === 'LogicInputElm' || destType === 'LogicOutputElm' ||
                                                   destType === 'OutputElm' || destType.includes('Rail') ||
                                                   destJsid.includes('Voltage') || destJsid.includes('Ground') ||
                                                   destJsid.includes('Rail') || destJsid.includes('Logic Input') ||
                                                   destJsid.includes('Logic Output') || destJsid.includes('Output');

                                // For power/ground/GPIO, use friendly label without pin numbers
                                let destMsg;
                                if (isRailOrGPIO) {
                                    destMsg = destLabel; // Friendly label with location info
                                } else {
                                    // Safely get pin name - some components throw IllegalArgumentException
                                    let destName;
                                    if (destSimple) {
                                        destName = v.pin + 1;
                                    } else {
                                        try {
                                            if (destCmp.getPinNames) {
                                                const pinNames = destCmp.getPinNames();
                                                destName = pinNames ? pinNames[v.pin] : v.pin + 1;
                                            } else {
                                                destName = v.pin + 1;
                                            }
                                        } catch (e) {
                                            // Component doesn't support getPinNames() - use pin number
                                            destName = v.pin + 1;
                                        }
                                    }
                                    destMsg = pinMsg(destSimple, destName, destLabel);
                                }

                                let msg = `Connect ${srcMsg} to ${destMsg}`;
                                wiringSteps.push(new BuildStep(msg, BuildStep.TYPE.CONNECT_COMPONENT, criteria, v));
                            });
                        });
                });
            });
        }

        // then connect all the components with wires
        instructions.push(...wiringSteps);

        this.logger.info("Generated", instructions.length, "total instructions");
        console.log("instructions", instructions.length, "steps generated");

        return instructions;
    }
}