class PinManagerUtil{
    constructor() {

        const s1 = (s)=>s.substring(1);

        this.inst = this.inst || {
            logger: new Logger('PinManagerController.util'),

                ignore:(jsid)=> {
                let label = CircuitModel.labelForJsid(jsid);
                return  [
                    'Rail',
                    'Logic Output',
                    'Output',
                    'Logic Input',
                    'Wire',
                    'Resistor',
                    'Capacitor',
                    'Diode',
                    'LED',
                    'Ground',
                    'Text',
                    'Voltage',
                    'Switch',
                    'Output',
                    'Inductor',
                    'Sweep'
                ].find(item => item === label) !== undefined;
            },

                html:{
                headers: ()=> `<div class="pm-bom-hdr">` +
                        `<div class='pm-bom-cell' style='flex-basis: 85%'>Component</div>` +
                        `<div class='pm-bom-cell' style='flex-basis: 15%'>Mapped</div>` +
                    `</div>`,

                    pin: (pin)=>`<div class="pm-draggable-pin pm-pin ui-draggable ui-draggable-handle pm-${pin.side}-pin" style="width: 40px; height: 20px;">` +
                        `<div class="pm-logical-pin pm-${pin.side}-logical-pin" logical-pin="${pin.logicalPin}" style="visibility: visible;">${pin.name}</div>` +
                        `<div class="pm-physical-pin pm-${pin.side}-physical-pin" style="visibility: visible;">${pin.physicalPin}</div>` +
                    `</div>`,

                    newPin:(logicalPin, pinName, css)=>`<div class="${s1(PinManagerController.util.cssIds.draggable_pin)} ${s1(PinManagerController.util.cssIds.pin)}${css?' '+css:''}">
                                                                    <div class="${s1(PinManagerController.util.cssIds.logical_pin)}" logical-pin="${logicalPin}">${pinName || ''}</div>
                                                                    <div class="${s1(PinManagerController.util.cssIds.physical_pin)}"></div>
                                                                </div>`,

                    bomItem:(key, li, selected)=> `<div class="pm-bom-row" style="${selected ? 'font-size: 12px; font-style: italics; font-weight: bold; background-color: darkorange; color: darkblue' : ''}" component="${CircuitModel.fullLabelForJsid(li.example)}">` +
                        `<div class='pm-bom-cell' style='flex-basis: 85%'>${key}</div>` +
                        `<div class='pm-bom-cell' style='flex-basis: 15%'>${li.mapping ? '&#x2705;' : '?'}</div>` +
                    `</div>`

            },

            cssIds: {
                bom_items: '#pm-bom-items',
                    // selected_bom_item: ".pm-bom-selected",

                    bkt_logical: '#pm-logical',

                    ic_name: '.pm-chip-name',
                    manufacturer_name_input: '#pm-manufacturer-name',
                    manufacturer_name: '.pm-chip-manufacturer',
                    manufacturer_model_nbr_input: '#pm-manufacturer-model-nbr',
                    manufacturer_model_nbr: '.pm-chip-model-nbr',

                    rail: '.pm-rail',
                    left_rail: '#left-rail',

                    right_rail: '#right-rail',
                    logical_pin: '.pm-logical-pin',

                    physical_pin: '.pm-physical-pin',
                    pin : '.pm-pin',
                    droppable_pin: '.pm-droppable-pin',
                    draggable_pin: '.pm-draggable-pin',

                    empty_pin: '.pm-empty',
                    left_pin: '.pm-left-pin',
                    right_pin: '.pm-right-pin',
                    left_physical_pin: '.pm-left-physical-pin',
                    left_logical_pin: '.pm-left-logical-pin',
                    right_physical_pin: '.pm-right-physical-pin',
                    right_logical_pin: '.pm-right-logical-pin',
            },

            newPin(logicalPin, pinName, css){

                PinManagerController.util.logger.debug(`newPin`, logicalPin, pinName, css);

                css = css || '';

                if(css instanceof Array){
                    css = css.join(' ');
                }

                return PinManagerController.util.html.newPin(logicalPin, pinName, css);
            },

            newEmptyPin(){
                let el = PinManagerController.util.newPin(null, 'X', s1(PinManagerController.util.cssIds.empty_pin));
                el = $(el).appendTo(PinManagerController.util.cssIds.bkt_logical);
                PinManagerController.util.draggable(el);
            },

            stripePins(){
                const sels = PinManagerController.util.cssIds;
                let lr = $(sels.left_rail).children();
                let rr = $(sels.right_rail).children();
                let lc = lr.length;
                let rc = rr.length;

                $(sels.left_rail).children().each((i, obj)=>{
                    $(sels.physical_pin, obj).html(i+1);
                });

                let rs = lc > rc?lc*2:rc*2;
                $(sels.right_rail).children().each((i, obj)=>{
                    $(sels.physical_pin, obj).html(rs-i);
                });
            },

            draggable(selector){
                return $(selector).draggable({
                    helper: 'clone',
                    connectToSortable: PinManagerController.util.cssIds.rail,
                    revert: 'invalid',
                    start: function (e, ui) {
                        $(this).hide();
                    },
                    stop: function (e, ui) {
                        if (!ui.helper.hasClass('dropped'))
                            $(this).show();
                    }
                });
            },

            sortable(sel){
                let sels = PinManagerController.util.cssIds;

                let toggleRailClasses = (leftSide)=>{

                    // physical pin appears over the "IC" in the middle
                    let physical = $(sels.physical_pin, leftSide ? sels.left_rail : sels.right_rail);
                    physical.removeClass(s1(sels.left_physical_pin));
                    physical.removeClass(s1(sels.right_physical_pin));
                    physical.addClass(s1(leftSide? sels.left_physical_pin:sels.right_physical_pin));
                    physical.css('visibility', 'visible');

                    // logical pin on the outside
                    let logical = $(sels.logical_pin, leftSide ? sels.left_rail : sels.right_rail);
                    logical.removeClass(s1(sels.left_logical_pin));
                    logical.removeClass(s1(sels.right_logical_pin));
                    logical.addClass(s1(leftSide? sels.left_logical_pin:sels.right_logical_pin));
                    logical.css('visibility', 'visible');
                };

                return $(sel).sortable({
                    connectWith: sels.rail,
                    stop: PinManagerController.util.stripePins,
                    receive: function (event, ui) {
                        PinManagerController.util.logger.debug('receive', $(sels.logical_pin, ui.item).text(), this.id, event, ui);

                        toggleRailClasses(this.id === s1(sels.left_rail));

                        // add a new "empty" pin to the logical pins
                        if ($(sels.bkt_logical).find(PinManagerController.util.cssIds.empty_pin + ':visible').length === 0) {
                            PinManagerController.util.newEmptyPin();
                        }

                        PinManagerController.util.stripePins();
                    },

                    beforeStop: function (event, ui) {

                        ui.item.addClass('dropped');
                        ui.item.css('height', 20);

                        if (this.id === s1(sels.left_rail)) {
                            ui.item.addClass(s1(sels.left_pin));
                        } else if (this.id === s1(sels.right_rail)) {
                            ui.item.addClass(s1(sels.right_pin));
                        }
                    },

                    remove: function (e, ui) {
                        if (ui.item.hasClass('dropped') && ui.item.parent().hasClass('pm-layout')) {
                            $('[data-id="' + ui.item.data('id') + '"]').show();
                            ui.item.removeClass('dropped');
                        }
                    }
                }).disableSelection();
            },

            syncPins(c, pins, pm){
                pm.view.clear();
                const util = PinManagerController.util;

                util.logger.log('syncPins', c, pins, pm);

                pins.forEach(item=> {
                    let target = $(item.side === 'left'?util.cssIds.left_rail:util.cssIds.right_rail);
                    target.append(util.html.pin(item));
                    target.sortable('refresh');
                });

                util.stripePins();
            },

            initPins(c, pm) {
                pm.clear();
                const u = PinManagerController.util;

                if(!c)
                    return;

                if(pm)
                    pm.component = c;

                for (let i = 0; i < c.getPostCount(); i++) {
                    let name = '';
                    let err = false;

                    try{
                        name = c.getPinNames()[i];
                    }
                    catch(e){
                        err = e;
                    }

                    if(err || !name || !name.trim()){
                        this.logger.debug(`caught ${err} determining pin name`);
                        name = (i === c.getPostCount()-1?'G':'p' + i);
                    }

                    $(u.cssIds.bkt_logical).append(u.newPin(i, name));
                }

                PinManagerController.util.draggable(u.cssIds.draggable_pin);
                PinManagerController.util.newEmptyPin();
                PinManagerController.util.sortable(u.cssIds.droppable_pin);
            },
        };
        return this.inst;
    }

    static instance(){
        return new PinManagerUtil();
    }
}