class Inspector {
    constructor(element, application) {

        this.logger = new Logger(this.constructor.name);

        this.application = application;
        this.element = element;
        this.$element = $(element);

        // set up the title bar
        this.$element.append(`<div class="inspector-title">Bill of Materials</div>`);

        // set up the draggable window body
        this.$element.append(`<div class="inspector-content"></div>`);

        // make the window draggable with a collapsing title bar
        this.draggable = this.$element.draggable({handle: '.inspector-title'});
        $('.inspector-title').once('click', ()=>$('.inspector-content').toggle(), Math.random());

        this.#initDraggable();

        // Subscribe to BOM updates
        this.application.sub('store:set', (eventName, data) => {
            if (data.key === 'bom') {
                this.logger.info('BOM updated, syncing Inspector view', data);
                this.syncToModel(data.value);
            }
        });
    }

    #initDraggable() {
        this.application.simulator.watch({notify:(op, jsid)=>{

                this.logger.info(`notify(${op}, ${jsid}`);
                const c =  this.application.simulator.findByJsid(jsid);
                const bm = this.application.store.get('bomMapping');

                if(!bm){
                    this.logger.warn('notify: no bom mapping found for ' + op + ' on jsid ' + jsid);
                    return;
                }

                if(op === 'add'){

                    if(!CircuitModel.isSimpleComponent(c) && !bm.isMapped(jsid)){
                        this.logger.info('mapping new complex component');
                        // this.application.buildStrategy.launchPinManager(c);
                    }

                    bm.add(new LineItem(c));
                }

                if(op === 'remove')
                    bm.remove(jsid);

                if(op === 'removeAll')
                    bm.clear();

            }});
    }

    syncToModel(bom){

        this.logger.info('syncToModel', {bom});

        const lineItemClickHandler = (e)=>{
            const label = $(e.currentTarget).attr('component-label');
            $(`.line-item-components[component-label='${label}']`).toggle();
        };

        const componentClickHandler = (e)=>{
            // const label = $(e.currentTarget).attr("component-label");
            const jsid = $(e.currentTarget.parentNode).attr('jsid');
            const label = CircuitModel.fullLabelForJsid(jsid);

            this.logger.info('componentClickHandler', {jsid, label, e});

            // set the view state
            this.application.breadboard.unhighlightMapped();
            this.application.overlayController.hideAll();
            this.application.overlayController.overlays.get(jsid).fadeComponentIn();
            this.application.breadboard.highlightByAttr(['jsid', jsid]);

            if(label === 'Voltage'){
                let v = this.application.circuitModel.getComponent(jsid).maxVoltage();
                this.application.breadboard.highlightByAttr(['voltage', v]);
            }

            if(label === 'Ground'){
                this.application.breadboard.highlightByAttr(['voltage', 0]);
            }
        };

        const linkClickHandler = (e) =>{
            let jsid = $(e.currentTarget).attr('jsid');
            this.logger.info('linkClickHandler', jsid, this.application.circuitModel.simplify());

            let comp = this.application.circuitModel.getComponent(jsid);
            let connections = this.application.circuitModel.simplify();

            for(let i=0; i<comp.getPostCount(); i++){
                let criteria = {comp: jsid, pin: i};

                [...connections.entries()]
                    .filter(([k, v])=> k.comp === jsid && k.pin === i)
                    .forEach(e=>{
                        console.log('======>', e);
                    });
            }
        };

        const typeClickHandler = (e) =>{
            let fullLabel = $(e.currentTarget).attr('component-label');
            this.logger.info('typeClickHandler', fullLabel);

            // Extract base label (without sublabel like " (3 pin)") for breadboard highlighting
            // The breadboard busses are tagged with component.label, not fullLabel
            const baseLabel = fullLabel.replace(/\s*\([^)]+\)\s*$/, '');

            this.application.breadboard.reset();
            this.application.overlayController.reset();
            this.application.breadboard.highlightByAttr(['label', baseLabel]);
            this.application.overlayController.fadeInByType(baseLabel);

            // veto event propagation so the component list doesn't expand / contract
            return false;
        };

        $('.inspector-content').html('');

        [...bom.lineItems.entries()]
            .sort(([k, v], [k1, v1]) => v.simple? 1 : -1)
            .sort(([k, v], [k1, v1]) => k.localeCompare(k1))
            .forEach(([k, v], i) => {
                $('.inspector-content').append(
                    Inspector.templates.bomItem(k, v, i)
                );
            });

        $('.line-item-details').once('click', lineItemClickHandler,      Math.random());
        $('.show-component').once('click', componentClickHandler,        Math.random());
        $('.show-component-links').once('click', linkClickHandler,       Math.random());
        $('.show-all-of-type').once('click', typeClickHandler,           Math.random());
    }

    static templates = {

        bomItem: (label, lineItem, i)=>`
            <div class="bom-line-item" style="padding: 10px" example="${lineItem.example}">
                <div class="line-item-details" component-label="${lineItem.fullLabel}"> 
                    <span style="text-align: left; display: table-cell;">${i+1})&nbsp;&nbsp;</span>
                    <span style="text-align: center; display: table-cell; width: 100%;">${lineItem.fullLabel} (qty: ${lineItem.quantity})</span>
                    <span class="clickable-icon show-all-of-type" component-label="${lineItem.fullLabel}" style="text-align: right; display: table-cell; padding-right: 10px;">&#x1F50D;</span>
                </div>
                <div class="line-item-components" component-label="${lineItem.fullLabel}">
                    ${Inspector.templates.bomItemComponents(lineItem, i)}
                </div>
            </div>`,

        bomItemComponents: (lineItem, row)=>`
            ${(() => {
            let result = '';

            lineItem.jsids.forEach((jsid, i)=>{
                result += `
                    <div class="line-item-component" jsid="${jsid}" style="padding: 10px; text-align: left; width: 100%; border: 1px solid green; white-space: nowrap;">
                        <div style="padding-left: 10px; padding-right:10px; display: table-cell">${row+1}.${i+1}</div>
                        <div style="width: 100%; display: table-cell;">${CircuitModel.getCharacteristics(jsid)} </div>
                        <div class="clickable-icon show-component-links" jsid="${jsid}" style="display: table-cell;">&#x1F517;</div>
                        <div class="clickable-icon show-component" style="display: table-cell; padding-left: 10px; padding-right: 10px;">&#x1F50D;</div>
                    </div>
                    `;
            });

            return result;
        })()}`
    };

}