class AbstractBuildTutorialStrategy {

    constructor() {
        this.logger = new Logger(Logger.LEVEL.INFO);
    }

    forward(evt) {
        this.logger.warn(".forward")
        throw "unimplemented"
    }

    back(evt) {
        throw "unimplemented"
    }

    totalSteps() {
        throw "unimplemented"
    }

    currentStep() {
        throw "unimplemented"
    }

    setCtx(application) {

        this.logger.info("setCtx", application);

        this.application = application;
        this.overlayController = this.application.overlayController;
        this.breadboard = this.application.breadboard;

        this.cursor = false;

        const changeHandler = (evt) => {
            this.steps = [];
            this.application.overlayController.setCtx(this.application);
        }

        this.overlayController.listenFor("circuitRead", changeHandler);

        // Subscribe to BOM updates to rebuild tutorial steps
        if (!this.bomSubscription) {
            this.bomSubscription = this.application.sub('store:set', (eventName, data) => {
                if (data.key === 'bom') {
                    this.logger.info('BOM updated, rebuilding tutorial steps', data);
                    this.buildSteps();
                }
            });
        }

        if(!this.nextBtn){
            this.nextBtn = $("#nextBtn", this.application.stepControls);
            this.backBtn = $("#backBtn", this.application.stepControls);
            this.resetBtn = $("#resetBtn", this.application.stepControls);
        }

        if(!this.handlerId){
            this.handlerId = this.application.simulator.randomString(10);

            this.nextBtn.once("click", () => this.forward(), "nxt-" + this.handlerId);
            this.backBtn.once("click", () => this.back(), "rst-" + this.handlerId);
            this.resetBtn.once("click", () => this.reset(this.application), "prv-" + this.handlerId);
        }
    }
}

class ComponentFocusedTutorialStrategy extends AbstractBuildTutorialStrategy {

    constructor() {
        super();
        this.logger = new Logger("ComponentFocusedTutorialStrategy");
    }

    // called by the application when the pin mapping is determined
    // RN that's after the pin manager closes, if there are no complex
    // components in the circuit.
    buildSteps() {
        this.logger.info("buildSteps()");

        if(!this.initialized){

            this.logger.info("Initializing in buildSteps");

            this.initialized = true;
            const notify  = (evt)=>{
                let bom = this.application.circuitModel.asBOM();
                this.logger.debug("notify", evt, "syncing bom inspector to simulator: bom", bom);
                // this.application.dbtsMenuController.bomView.syncToModel(bom);
            }

            notify("buildSteps");
            this.application.simulator.watch({notify});
        }

        this.steps = [];
        this.stepNbr = 0;
        this.cursor = {stepNbr: 0, component: false};

        this.breadboard.clear();
        this.breadboard.syncToModel();

        // this.application.bomView.syncToModel(this.application.circuitModel.asBOM());

        let generator = new BomBasedBuildInstructions(this.application);
        this.steps = generator.generate();

        this.logger.info("built steps:", this.steps);

        // Emit tutorial steps generated event
        this.application.pub('tutorial:steps:generated', {
            steps: this.steps,
            stepCount: this.steps.length,
            timestamp: Date.now()
        });
    }

    displayCurrentStep() {
        if(!this.cursor)
            this.buildSteps();

        let step = this.cursor.step;
        let pstep = this.cursor.pstep;
        this.logger.info("displayCurrentStep", step, pstep);

        this.handleCurrentStep(step);

        // Emit step displayed event
        this.application.pub('tutorial:step:displayed', {
            stepNbr: this.cursor.stepNbr,
            step: step,
            total: this.steps.length,
            timestamp: Date.now()
        });
    }

    handleCurrentStep(step) {

        this.logger.info("handleCurrentStep", step);

        // reset everything.
        this.application.breadboard.unhighlightMapped();
        this.application.overlayController.overlays.forEach(overlay => overlay.unhighlightPins());
        this.application.overlayController.overlays.forEach(overlay => overlay.unhighlightComponent());
        this.application.overlayController.reset();

        if (step.type === BuildStep.TYPE.PLACE_COMPONENT) {
            this.application.stepContentView.html(step.text);
            this.application.breadboard.highlightByAttr(["jsid", step.src.comp]);
            this.application.overlayController.overlays.get(step.src.comp).fadeComponentIn();
            this.application.overlayController.overlays.get(step.src.comp).fadePinsIn();
        }

        if (step.type === BuildStep.TYPE.CONNECT_COMPONENT) {
            let src = step.src;
            let dest = step.dest;

            this.logger.info("handling connection step src / dest", {src, dest})

            let sview = this.application.overlayController.overlays.get(src.comp);
            let dview = this.application.overlayController.overlays.get(dest.comp);

            // Helper to check if component is a rail or GPIO (which don't have overlays)
            const isRailOrGPIO = (jsid) => {
                try {
                    let comp = CircuitModel.getComponent(jsid);
                    if (!comp) return false;

                    let type = comp.getType ? comp.getType() : '';
                    return type === 'VoltageElm' || type === 'GroundElm' || type.includes('Rail') ||
                           type === 'LogicInputElm' || type === 'LogicOutputElm' || type === 'OutputElm';
                } catch(e) {
                    // Fallback to label checking
                    let label = CircuitModel.labelForJsid(jsid);
                    return label.includes('Voltage') || label.includes('Ground') ||
                           label.includes('Rail') || label.includes('Logic Input') ||
                           label.includes('Logic Output') || label.includes('Output');
                }
            };

            let srcIsRailOrGPIO = isRailOrGPIO(src.comp);
            let destIsRailOrGPIO = isRailOrGPIO(dest.comp);

            // Show sim pins for components that have overlays
            if (sview && !srcIsRailOrGPIO) {
                sview.fadePinIn(src.pin);
                sview.highlightPin(src.pin);
            }

            if (dview && !destIsRailOrGPIO) {
                dview.fadePinIn(dest.pin);
                dview.highlightPin(dest.pin);
            }

            // Always highlight on breadboard (works for both components and rails)
            this.application.breadboard.highlightBus(src.comp, src.pin);
            this.application.breadboard.highlightBus(dest.comp, dest.pin);
        }

        this.logger.info("rendering instructions", step.text);
        this.application.stepContentView.html(step.text);
    }

    forward() {
        this.logger.info("forward()");

        if(!this.cursor)
            this.buildSteps();

        const previousStepNbr = this.cursor.initialized ? this.cursor.stepNbr : -1;

        if (!this.cursor.initialized) {
            this.cursor.stepNbr = 0;
            this.cursor.initialized = true;
        } else {
            this.cursor.stepNbr++;
        }

        const wrappedAround = this.cursor.stepNbr === this.steps.length;
        if (wrappedAround) {
            this.cursor.stepNbr = 0;
        }

        if (this.cursor.step !== undefined) {
            this.cursor.pstep = this.cursor.step;
        }

        this.cursor.step = this.steps[this.cursor.stepNbr];

        this.logger.info("next", this.cursor.stepNbr, this.cursor.step);

        // Emit tutorial completed event if we just finished the last step
        if (previousStepNbr === this.steps.length - 1 && wrappedAround) {
            this.application.pub('tutorial:completed', {
                totalSteps: this.steps.length,
                timestamp: Date.now()
            });
        }

        // Emit step forward event
        this.application.pub('tutorial:step:forward', {
            from: previousStepNbr,
            to: this.cursor.stepNbr,
            step: this.cursor.step,
            total: this.steps.length,
            timestamp: Date.now()
        });

        // Emit step changed event
        this.application.pub('tutorial:step:changed', {
            from: previousStepNbr,
            to: this.cursor.stepNbr,
            step: this.cursor.step,
            direction: 'forward',
            timestamp: Date.now()
        });

        this.displayCurrentStep();
    }

    back(evt) {
        this.logger.info("back", evt);

        if(!this.cursor)
            this.buildSteps();

        const previousStepNbr = this.cursor.initialized ? this.cursor.stepNbr : -1;

        // for those who like to start at the back of the book.
        if (!this.cursor.initialized) {
            this.cursor.stepNbr = this.steps.length - 1;
            this.cursor.initialized = true;
        } else {
            --this.cursor.stepNbr;
        }

        if (this.cursor.stepNbr === -1) {
            this.cursor.stepNbr = this.steps.length - 1;
        }

        if (this.cursor.step !== undefined) {
            this.cursor.pstep = this.cursor.step;
        }

        this.cursor.step = this.steps[this.cursor.stepNbr];

        this.logger.info("previous", this.cursor.stepNbr);

        // Emit step backward event
        this.application.pub('tutorial:step:backward', {
            from: previousStepNbr,
            to: this.cursor.stepNbr,
            step: this.cursor.step,
            total: this.steps.length,
            timestamp: Date.now()
        });

        // Emit step changed event
        this.application.pub('tutorial:step:changed', {
            from: previousStepNbr,
            to: this.cursor.stepNbr,
            step: this.cursor.step,
            direction: 'backward',
            timestamp: Date.now()
        });

        this.displayCurrentStep();
    }

    reset() {
        this.logger.info("reset()");

        // Emit reset and steps cleared events
        this.application.pub('tutorial:steps:cleared', {
            timestamp: Date.now()
        });

        this.application.pub('tutorial:reset', {
            timestamp: Date.now()
        });

        this.setCtx(this.application);
    }

    totalSteps() {
        return this.steps.length;
    }

    currentStep() {
        return this.cursor.stepNbr;
    }
}

