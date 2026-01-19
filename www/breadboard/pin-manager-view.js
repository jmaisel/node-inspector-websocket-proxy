class PinManagerView{

    constructor(divId, application, c, pinManagerController){

        this.logger = new Logger('PinManagerView');
        this.application = application;
        this.pinManagerController = pinManagerController;
        this.selectors = PinManagerController.util.cssIds;

        this.dialog = $(divId).dialog({
            autoOpen: false,
            hide: {effect: 'explode', duration: 1500},
            show: {effect: 'blind', duration: 1000},
            title: `${c?c.jsid:''} Pin Manager`,
            dialogClass: 'no-close',
            width: 620,
            maxWidth: 620,
            minWidth: 620,
            height: 460,
            maxHeight: 460,
            minHeight: 460,
            buttons: [
                {
                    text: 'Save',
                    click: (e) => {this.logger.info('save', this.pinManagerController); this.pinManagerController.save(this.saveCallback);}
                    // click: this.pinManagerController.save
                },
                {
                    text: 'Clear',
                    click: (e) => {this.logger.info('clear', this.pinManagerController); this.clear();}
                    // click: (e) => this.clear
                }
            ]
        });

    }

    singleMode(){
        $('#pm-bom').hide();
        $('#pm-mapping-tip').fadeOut();
        $('#pm-create-mapping').fadeIn();
    }

    listMode(){
        $('#pm-bom').show();
        $('#pm-create-mapping').fadeOut();
        $('#pm-mapping-tip').fadeIn();
    }

    populateList(component){
        this.logger.debug('populateList()');

        const cm = this.application.circuitModel;
        const bom = cm.asBOM();
        this.logger.debug('bom:', bom);

        const renderList = ()=> {

            this.logger.info('renderList()', bom.lineItems, this.editing);

            // Clear previous items and rerender headers
            $(this.selectors.bom_items).empty().append(PinManagerController.util.html.headers());

            [...bom.lineItems.entries()]
                .filter(([k, v]) => !CircuitModel.isSimpleComponent({jsid:v.example}))
                .filter(([k, v]) => !PinManagerController.util.ignore(v.example))
                .filter(([k, v]) => !this.application.circuitModel.bomMapping || !this.application.circuitModel.bomMapping.isMapped(v.example) )
                .forEach(([k, v]) => {
                    let li = v;

                    const key = li.fullLabel;
                    const selected = this.editing?$(this.editing).attr('component') === key:false;

                    const itemElement = $(PinManagerController.util.html.bomItem(key, li, selected));

                    itemElement.on('click', clickHandler);

                    $(this.selectors.bom_items).append(itemElement);
                });
        };
        const mapInput = ()=>{

            let result = {
                pins: this.pinManagerController.getUserMapping(),
                manufacturer: $(this.selectors.manufacturer_name_input).val(),
                sku: $(this.selectors.manufacturer_model_nbr_input).val()
            };

            this.logger.info('mapit returning', result);

            return result;
        };

        const resetDialog = (state)=>{
            $('#pm-mapping-tip').hide();
            $('#pm-create-mapping').fadeIn();
            this.clearMappingDetails();
            this.title($(state.clickedRow).attr('component'));
        };

        const updateView = (state)=>{

            this.logger.info('updateView', state);
            let cm = this.application.circuitModel;
            let lineItem = cm.asBOM().itemByLabel(state.fullLabel);

            if(lineItem && lineItem.example && cm.asBOM().isMapped(lineItem.example)){
                this.displayMappingDetails(state.fullLabel, cm.asBOM().lineItems.get(state.fullLabel).mapping);
                PinManagerController.util.newEmptyPin();
            }
            else{
                PinManagerController.util.initPins(cm.getComponent(lineItem.example), this);
            }

            this.editing = state.clickedRow;
        };

        const clickState = (e)=>{

            this.logger.info('clickState', e.currentTarget);
            const fullLabel = $(e.currentTarget).attr('component');

            const state = {
                clickedRow: e.currentTarget,
                previousRow: this.editing?this.editing:false,
                fullLabel: fullLabel,
                newMapping: mapInput()
            };

            state.previousLabel = state.previousRow?$(state.previousRow).attr('component'):false;

            return state;
        };

        const clickHandler = (e) => {

            const state = clickState(e);

            resetDialog(state);
            this.pinManagerController.saveMapping(state);
            updateView(state);

            renderList();
        };

        const handleSingleJsid = (component)=>{
            alert(CircuitModel.labelForJsid(component.jsid));
        };

        if(component){
            handleSingleJsid(component);
        }
        else{
            renderList();
        }
    }

    clearMappingDetails(){
        this.logger.log('clearMappingDetails()');

        $(this.selectors.manufacturer_model_nbr_input).val('');
        $(this.selectors.manufacturer_name_input).val('');
        $(this.selectors.manufacturer_name).html('');
        $(this.selectors.manufacturer_model_nbr).html('');
    }

    displayMappingDetails(fullLabel, mapping) {

        this.logger.log('displayMappingDetails', fullLabel, mapping);
        this.title(fullLabel);
        let cm = this.application.circuitModel;

        if(mapping){
            $(this.selectors.manufacturer_name_input).val(mapping.manufacturer);
            $(this.selectors.manufacturer_model_nbr_input).val(mapping.sku);
            $(this.selectors.manufacturer_name).html(mapping.manufacturer);
            $(this.selectors.manufacturer_model_nbr).html(mapping.sku);
        }

        if(mapping.pins){
            let lineItem = this.application.circuitModel.asBOM().itemByLabel(fullLabel);
            PinManagerController.util.syncPins(cm.getComponent(lineItem.example), mapping.pins, this);
        }
        else{
            let jsid = this.application.circuitModel.asBOM().itemByLabel(fullLabel).jsid;
            PinManagerController.util.initPins(cm.getComponent(jsid), this);
        }

    }

    show(saveCallback) {
        this.saveCallback = saveCallback;
        this.dialog.dialog('open');
    }

    title(title){
        $(this.selectors.ic_name).html(title);
        this.dialog.dialog('option', 'title', title);
    }

    close() {
        this.dialog.dialog('close');
    }

    clear(){
        $(this.selectors.bkt_logical).html('');
        $(this.selectors.rail).html('');
    }
}
