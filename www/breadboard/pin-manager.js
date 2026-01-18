
class PinManagerController {
    constructor(divId, application, c) {

        this.application = application;
        this.logger = new Logger("PinManagerController");
        this.selectors = PinManagerController.util.cssIds;
        this.view = new PinManagerView(divId, application, c, this);

        if(c){
            PinManagerController.util.initPins(c, this);
        }

        let update = (e)=>{
            $(this.selectors.manufacturer_name).html($(this.selectors.manufacturer_name_input).val());
            $(this.selectors.manufacturer_model_nbr).html($(this.selectors.manufacturer_model_nbr_input).val())
        }

        $(this.selectors.manufacturer_name_input).on("keyup blur focus", update);
        $(this.selectors.manufacturer_model_nbr_input).on("keyup blur focus", update);
    }

    // returns an array of json objects specifying the pins logical and physical names / ids / numbers
    // sorted by the physical pin number to facilitate layout routines on the breadboard
    getUserMapping(){
        this.logger.debug("getMapping()");

        const l = $(this.selectors.left_rail).children();
        const r = $(this.selectors.right_rail).children();
        let items = [], result = [];
        let lidx = 0, ridx = 0;

        [l, r].forEach((side)=>side.toArray().forEach((mappedPin)=>{

            // const side = $(item).attr("class") && $(item).attr("class").indexOf('left') !== -1 ?'left':'right';
            const side = $(mappedPin).attr("class") && $(mappedPin).attr("class").indexOf('left') !== -1 ?'left':'right';

            const map = {
                idx: side === "left"?lidx++:ridx++,
                name: $(mappedPin).find(this.selectors.logical_pin).text(),
                side: side,
                logicalPin: parseInt($(mappedPin).find(this.selectors.logical_pin).attr("logical-pin")),
                physicalPin: parseInt($(mappedPin).find(this.selectors.physical_pin).html())
            }

            items.push(map);
        }))

        items = items.sort((a, b)=>a.component - b.component);

        // fill in the gaps
        let offset = 0;
        items.forEach((item, i)=>{

            if(item.component !== i + offset){
                let d = item.component - i;
                offset += d;

                while(d > 0){
                    result.push({component: i + offset - d, simulator: "X"});
                    d--;
                }
            }

            result.push(item);
        })

        this.logger.debug("getMapping returning", result);
        return result;
    }

    saveMapping(state){
        if(state.previousRow){
            let bom = this.application.circuitModel.asBOM();
            this.logger.log("applying new mapping to previousRow", state.previousLabel, state.newMapping, {lineItems: bom.lineItems});
            bom.lineItems.get(state.previousLabel).mapping = state.newMapping;
            this.application.store.set("bomMapping", bom);
        }
    }

    save(saveCallback) {
        if(this.editing){
            let mapping = {
                previousRow: this.editing,
                previousLabel:$(this.editing).attr("component"),
                newMapping: {
                    pins: this.getUserMapping(),
                    manufacturer: $(this.selectors.manufacturer_name_input).val(),
                    sku: $(this.selectors.manufacturer_model_nbr_input).val()
                }
            }

            this.logger.info("save()", mapping)
            this.saveMapping(mapping);

        }
        if(saveCallback) {
            saveCallback(this);

        }

        this.view.close();
    }

    static util = PinManagerUtil.instance()
}
