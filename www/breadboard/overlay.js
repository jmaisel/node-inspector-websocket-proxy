class OverlayController {

    static MENU_OFFSET = 31;
    static CSS_CLASS_POINT = 'overlay-point';
    static CSS_CLASS_AREA = 'overlay-area';
    mapping = {};
    listeners = [];

    constructor() {
        this.logger = new Logger('OverlayController');
    }

    clear(){
        this.logger.info('clear()');
        this.application.simulatorView.find('.' + OverlayController.CSS_CLASS_AREA).remove();
        this.application.simulatorView.find('.' + OverlayController.CSS_CLASS_POINT).remove();
        this.overlays = new Map();
    }

    reset(){
        this.hideAll();
    }

    remove(jsid){
        if(this.overlays.has(jsid)){
            this.overlays.get(jsid).delete();
            this.overlays.delete(jsid);
        }
    }

    setCtx(ctx) {
        this.logger.info('setCtx', ctx);
        let observer = {notify:(op, jsid)=> {
            this.logger.info(`observing model change and synching`);
            // this.clear();
            this.mapping = this.application.simulator.buildComponentMapping();

            switch(op){
                case 'add':
                    // todo: check for visible overlays, and if the type, jsid, etc apply, then make it visible when created.
                    this.overlayComponent(jsid);
                    break;

                case 'remove':
                    this.remove(jsid);
                    break;

                case 'removeAll':
                    this.clear();
                    break;
            }
        }};

        if(!this.application){
            ctx.simulator.watch(observer);
        }

        this.application = ctx;
        this.clear();
        observer.notify();
    }

    boundsFor(jsid) {
        this.logger.info('boundsFor', jsid);

        const simulator = this.application.simulator;
        const comp = this.application.simulator.findByJsid(jsid);

        if (comp) {
            const ratio = simulator.getTransform()[0];
            const bounds = comp.getBoundingBox();

            let css = {
                left: simulator.transformX(bounds.minX),
                top: simulator.transformY(bounds.minY) + OverlayController.MENU_OFFSET
            };

            // simple components like wires, resistors, etc.
            if(CircuitModel.isSimpleComponent(comp)){
                this.logger.info('determining bounds for simple component (2 pins or less)', bounds);
                css.width = bounds.width && bounds.width > 0 ? bounds.width : 20 * ratio;
                css.height = (bounds.height ? bounds.height : bounds.maxY - bounds.minY) * ratio;

                // horizontal
                if (css.height === 0) {
                    css.height = 20 * ratio;
                    css.width = (bounds.maxX - bounds.minX) * ratio;
                    css.top -= css.height / 2;
                }
                // vertical
                else {
                    css.left -= css.width / 2;
                }
            }
            else{
                this.logger.info('determining bounds for complex component (more than 2 pins)', bounds);
                css.width = bounds.width * ratio;
                css.height = bounds.height * ratio;
            }

            return css;
        }
    }

    transformPoint(p){
        this.logger.debug('transformPoint', p);

        if(!p.size)
            p.size = 0;

        const simulator = this.application.simulator;
        const transform = simulator.getTransform();

        let w = p.size * transform[0];
        let h = p.size * transform[3];
        let x = simulator.transformX(p.x) - w / 2;
        let y = simulator.transformY(p.y) - h / 2 + OverlayController.MENU_OFFSET;

        let result = {left: x, top: y, width: w, height: h};
        return result;
    }

    overlayPoint(p, size, css, attrs) {
        this.logger.info('overlayPoint', p, size, css);
        p.size = size;

        let id = `${OverlayController.CSS_CLASS_POINT}-${this.application.simulator.randomString(5)}`;
        let place = this.transformPoint(p);
        let styles = Object.assign(place, css || {});

        this.application.simulatorView
            .append(`<div id="${id}" class="${OverlayController.CSS_CLASS_POINT}"></div>`);

        let result = $(`#${id}`, this.application.simulatorView);
        result.css(styles);
        result.attr(attrs);

        return result;
    }

    overlayPins(jsid, size, css) {
        this.logger.info('overlayPins', {jsid, size, css});
        let pins = [];
        this.pins = pins;

        // let comp = this.mapping.components[componentId];
        let comp = this.application.circuitModel.getComponent(jsid);

        if (comp) {
            for (let i = 0; i < comp.getPostCount(); i++) {
                let pin = comp.getPost(i);
                let point = this.overlayPoint(pin, size || 10, css, {jsid, pin: i});
                pin.point = point;
                pins.push(pin);
            }
        }

        if (pins.length) {
            pins.delete = () => pins.forEach(v => v.point.remove());
            return pins;
        }
    }

    overlayArea(css, attrs) {
        this.logger.info('overlayArea', {css, attrs});

        const id = `${OverlayController.CSS_CLASS_AREA}-${this.application.simulator.randomString(5)}`;

        this.application
            .simulatorView
            .append(`<div id="${id}" class="${OverlayController.CSS_CLASS_AREA}"></div>`);

        $(`#${id}`, this.application.simulatorView).attr(attrs);

        return $(`#${id}`, this.application.simulatorView).css(css);
    }

    overlayComponent(jsid, css, pinSize, pinCss) {

        this.logger.info('overlayComponent', {jsid, css, pinSize, pinCss});

        if(this.overlays.has(jsid)){
            this.logger.info(`overlay exists for ${jsid}`);
            return;
        }

        const comp = this.application.simulator.findByJsid(jsid);
        const label = CircuitModel.fullLabelForJsid(jsid);

        if (comp) {

            const styles = this.boundsFor(jsid);
            const component = this.overlayArea(Object.assign(styles, css || {}), {jsid, label});
            const pins = this.overlayPins(jsid, pinSize, pinCss);

            const overlay = {
                component: component,
                label: label,
                pins: pins,
                delete: () => {
                    overlay.component.remove();
                    overlay.pins.delete();
                    this.overlays.delete(jsid);
                }
            };

            this.overlays.set(jsid, new ComponentOverlayView(comp, overlay));
            return this.overlays.get(jsid);
        }
        else{
            this.logger.warn('NO COMPONENT FOUND FOR JSID', jsid);
        }
    }

    handleCircuitRead(file){
        this.logger.info('handleCircuitRead', file);
        this.setCtx(this.application);
        this.notify({name:'circuitRead'});
    }

    // keeps the overlay in sync with the components during zoom
    // can also handle moving overlay dom elements after moving all or part of the
    // simulator model around
    handleScaleChange() {
        this.logger.debug('handleScaleChange()');

        let components = this.mapping.components;

        Object.keys(components).forEach((k) => {
            let comp = components[k];

            if (comp.view && comp.view.overlay && comp.view.overlay.pins) {

                // move / scale pins
                comp.view.overlay.pins.forEach((v, i)=>{
                    let newLoc = comp.getPost(i);
                    newLoc.size = v.size;
                    let bounds = this.transformPoint(newLoc);
                    v.point.css(bounds);
                });

                // move / scale component
                let bounds = this.boundsFor(k);
                comp.view.overlay.component.css(bounds);
            }
        });

        this.notify({name: 'scaleChange'});
    }

    findByType(type){
        const result = new Set();

        [...this.application.overlayController.overlays.entries()]
            .filter(([k,v])=>type === CircuitModel.fullLabelForJsid(k))
            .forEach(([k, v])=>{result.add(v);});

        return result;
    }

    fadeInByType(type){
        this.findByType(type).forEach(overlay => overlay.fadeComponentIn());
    }

    fadeOutByType(type){
        this.findByType(type).forEach(overlay => overlay.fadeComponentOut());
    }

    hideAll(){
        [...this.overlays.values()].forEach(v => {
            v.fadeComponentOut();
            v.fadePinsOut();
        });
    }

    listenFor(name, fn) {
        if (!fn || this.listeners.indexOf(fn) !== -1)
            return;

        this.listeners.push({name:name, fn:fn});
    }

    notify(evt) {
        this.logger.info('notify', evt);
        this.listeners.filter(value => value.name === evt.name).forEach(value => value.fn(evt));
    }
}

class ComponentOverlayView {

    constructor(component, overlay) {
        this.logger = new Logger('ComponentOverlayView');
        this.component = component;
        this.overlay = overlay;

        this.logger.info('constructor', {component, overlay});
    }

    static FADE_DELAY = 1;

    highlight = () => {
        this.logger.info('highlight()');
        this.highlightComponent();
        this.highlightPins();
    };

    unhighlight = () => {
        this.logger.info('unhighlight()');
        this.unhighlightComponent();
        this.unhighlightPins();
    };

    fadeIn = () => {
        this.logger.info('fadeIn()');
        this.fadeComponentIn();
        this.fadePinsIn();
    };

    fadeOut = () => {
        this.logger.debug('fadeOut()', this.overlay);
        this.overlay.component.fadeOut();

        if(this.overlay.pins)
            this.overlay.pins.forEach((pin, idx) => {
            this.logger.debug('fading pin out', pin);
            pin.point.fadeOut();
        });
    };

    fadeComponentIn = () => {
        this.logger.debug('fadeComponentIn()');
        setTimeout(() => {
            this.overlay.component.fadeIn();
        }, ComponentOverlayView.FADE_DELAY);
    };

    fadeComponentOut = () => {
        this.logger.debug('fadeComponentOut()');
        setTimeout(() => {
            this.overlay.component.fadeOut();
        }, ComponentOverlayView.FADE_DELAY);
    };

    fadePinIn = (idx) => {
        this.logger.debug(`fadePinIn(${idx})`);

        setTimeout(() => {
            this.logger.debug(`fading in pin ${idx} from `, this.overlay);
            this.overlay.pins[idx].point.fadeIn();
        }, ComponentOverlayView.FADE_DELAY);
    };

    fadePinOut = (idx) => {
        this.logger.debug(`fadePinOut(${idx})`);

        setTimeout(() => {
            this.logger.debug(`fading out pin ${idx} from `, this.overlay);
            this.overlay.pins[idx].point.fadeOut();
        }, ComponentOverlayView.FADE_DELAY);
    };

    fadePinsIn = () => {
        this.logger.debug('fadePinsIn()');
        this.overlay.pins.forEach((v, i) => this.fadePinIn(i));
    };

    fadePinsOut = () => {
        this.logger.debug('fadePinsOut()');
        this.overlay.pins.forEach((v, i) => this.fadePinOut(i));
    };

    highlightPin = (idx) => {
        this.logger.debug('highlightPin', idx);
        setTimeout(() => {
            this.overlay.pins[idx].point.css({animation: 'pulse 2s infinite'});
        }, ComponentOverlayView.FADE_DELAY);
    };

    unhighlightPin = (idx) => {
        this.logger.debug('unhighlightPin', idx);
        setTimeout(() => {
            this.overlay.pins[idx].point.css({animation: ''});
        }, ComponentOverlayView.FADE_DELAY);
    };

    highlightPins = () => {
        this.logger.debug('highlightPins()');
        this.overlay.pins.forEach((v, i) => this.highlightPin(i));
    };

    unhighlightPins = () => {
        this.logger.debug('unhighlightPins()');
        this.overlay.pins.forEach((v, i) => this.unhighlightPin(i));
    };

    highlightComponent = () => {
        this.logger.debug('highlightComponent()');
        this.overlay.component.css({animation: 'pulse 2s infinite'});
    };

    unhighlightComponent = () => {
        this.logger.debug('unhighlightComponent()');
        this.overlay.component.css({animation: ''});
    };

    delete = () => {
        this.logger.debug('delete()');
        this.overlay.delete();
    };
}