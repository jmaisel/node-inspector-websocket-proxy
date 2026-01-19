class GutterController{
    constructor(split, gutterSel, gutterControlsSel) {
        this.logger = new Logger("GutterController");

        this.split = split;
        this.gutterSel = gutterSel;
        this.gutterControlsSel = gutterControlsSel || "#gutter-buttons";

        this.bind();
    }

    bind(){

        this.logger.info(".bind()");

        this.gutter = $(this.gutterSel);
        let gutterControls = $(this.gutterControlsSel);

        gutterControls.adjust = ()=>{
            this.logger.debug("gutterControls.adjust");
            let pos = this.gutter.position()
            let left = pos.left - (gutterControls.width()/2) + (this.gutter.width()/2);
            gutterControls.css({top: pos.top + 30, left: left});
            gutterControls.show();
        }
        this.controls = gutterControls;

        this.maxCode = $("#max-left").click(()=>{
            this.logger.info("maxCode");
            if(!this.split.lastPosition)
                this.split.lastPosition = this.split.getSizes();
            this.split.setSizes([100, 0])
        })

        this.returnGutter = $("#return-gutter").click(()=>{
            this.logger.info("returnGutter");
            if(this.split.lastPosition)
                this.split.setSizes(this.split.lastPosition);

            this.split.lastPosition = false;
        });

        this.maxSim = $("#max-right").click(()=>{
            this.logger.info("maxSim");
            if(!this.split.lastPosition)
                this.split.lastPosition = this.split.getSizes();

            this.split.setSizes([0, 100]);
        })

        this.logoBtnContainer = $("#logo-btn-container").click(()=>{
            this.logger.info("logoBtn");
            const menu = $("#dbts-menu");
            menu.is(":visible")?menu.fadeOut(250):menu.fadeIn(250);
        });

        let isDragging = false;
        let isDown = false;

        this.gutter
            .mousedown( ()=> {
                this.logger.debug("this.gutter.mousedown");
                isDragging = false;
                isDown = true;
            })
            .mousemove( ()=> {
                this.logger.debug("this.gutter.mousemove");
                isDragging = isDown;
                if(isDragging)
                    this.controls.adjust();
            })
            .mouseup( ()=> {
                this.logger.debug("this.gutter.mouseup");
                isDragging = false
                isDown = false;
                this.controls.adjust();
            });
    }
}

class DBTSMenuController{
    constructor(gutterController, dbtsMenuSel, dbtsBtnSel) {

        this.logger = new Logger("DBTSMenuController");

        this.logger.info("constructor", gutterController, dbtsMenuSel, dbtsBtnSel);

        this.dbtsMenuSel = dbtsMenuSel || "";
        this.dbtsBtnSel = dbtsBtnSel || "";
        this.gutterController = gutterController;

        this.bind();
    }

    setCtx(ctx){
        this.logger.info("setCtx", ctx);
        this.application = ctx;
        this.buildStrategy = this.application.buildStrategy;
    }

    designMode(){
        this.logger.info("designMode()");

        // Get previous mode before switching
        const previousMode = this.application.store.get('mode') || null;
        const timestamp = Date.now();

        // Emit exit event for previous mode if there was one
        if (previousMode && previousMode !== 'design') {
            this.application.pub(`mode:${previousMode}:exited`, { timestamp });
        }

        this.application.bom.fadeOut();
        // this.gutterController.maxSim.click();
        this.application.overlayController.clear();
        this.application.breadboard.hide();

        // Update mode in store and emit events
        this.application.store.set('mode', 'design');
        this.application.pub('mode:design:entered', { timestamp, previousMode });

        if (previousMode && previousMode !== 'design') {
            this.application.pub('mode:changed', {
                from: previousMode,
                to: 'design',
                timestamp
            });
        }
    }

    buildMode(){
        this.logger.info("buildMode()");

        // Get previous mode before switching
        const previousMode = this.application.store.get('mode') || null;
        const timestamp = Date.now();

        // Emit exit event for previous mode if there was one
        if (previousMode && previousMode !== 'build') {
            this.application.pub(`mode:${previousMode}:exited`, { timestamp });
        }

        this.application.overlayController.setCtx(this.application);

        this.logger.info("buildMode: building steps, showing breadboard and BOM");

        if(!this.application.bomView){
            this.application.bomView = new Inspector("#bom-inspector", this.application);
        }

        // Ensure circuit model exists before building steps
        if(!this.application.circuitModel){
            this.application.circuitModel = new CircuitModel(this.application);
        }

        // Update BOM in store - views will sync automatically via events
        let bom = this.application.circuitModel.asBOM();
        this.application.store.set("bom", bom);

        // Build tutorial steps (uses circuitModel internally)
        this.application.buildStrategy.buildSteps();

        this.application.breadboard.show();
        this.application.bom.fadeIn();

        this.gutterController.controls.adjust();

        // Update mode in store and emit events
        this.application.store.set('mode', 'build');
        this.application.pub('mode:build:entered', { timestamp, previousMode });

        if (previousMode && previousMode !== 'build') {
            this.application.pub('mode:changed', {
                from: previousMode,
                to: 'build',
                timestamp
            });
        }
    }

    bind(){

        this.logger.info("bind()");

        this.dbtsMenu = $(this.dbtsMenuSel);
        this.dbtsBtns = $(this.dbtsBtnSel);

        this.dbtsBtns.click((e)=>{

            switch($(e.target).attr("cmd")){
                case "design":
                    this.designMode();
                    break;

                case "build":
                    this.buildMode();
                    break;

                case "test":
                    break;

                case "share":
                    break;
            }

            this.dbtsMenu.toggle("slow");
        });
    }
}

class ObservableMap extends Map {
    constructor(application) {
        super();
        this.application = application;
    }

    set(key, value) {
        const hadKey = this.has(key);
        const oldValue = hadKey ? this.get(key) : undefined;
        const result = super.set(key, value);

        if (this.application && this.application.pub) {
            this.application.pub('store:set', {
                key: key,
                value: value,
                oldValue: oldValue,
                isNew: !hadKey
            });
        }

        return result;
    }

    delete(key) {
        const hadKey = this.has(key);
        const oldValue = hadKey ? this.get(key) : undefined;
        const result = super.delete(key);

        if (result && this.application && this.application.pub) {
            this.application.pub('store:delete', {
                key: key,
                oldValue: oldValue
            });
        }

        return result;
    }

    clear() {
        const entries = Array.from(this.entries());
        super.clear();

        if (this.application && this.application.pub) {
            this.application.pub('store:clear', {
                previousEntries: entries
            });
        }
    }
}

class Pithagoras{

    constructor(ctx) {
        this.logger = new Logger("Pithagoras");
        this.ctx = ctx || {};

        // Initialize pub/sub system
        this.subscriptions = [];

        // Add a method to the Array prototype to remove an object by value
        Array.prototype.removeByValue = function(value, key = 'id') {
            if (value && typeof value === 'object' && key in value) {
                const filteredArray = this.filter(obj => obj[key] !== value[key]);
                this.length = 0;
                this.push(...filteredArray);
            }
            return this;
        };
    }

    /**
     * Subscribe to events matching a regex pattern
     * @param {RegExp|string} pattern - Regular expression or string pattern to match event names
     * @param {Function} observer - Observer function called with (eventName, data) when matching events are published
     * @returns {Object} Subscription object that can be used to unsubscribe
     */
    sub(pattern, observer) {
        if (!pattern) {
            throw new Error("Pattern is required for subscription");
        }

        if (typeof observer !== 'function') {
            throw new Error("Observer must be a function");
        }

        // Convert string to RegExp if needed
        let regex;
        try {
            regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
        } catch (e) {
            throw new Error(`Invalid regex pattern: ${e.message}`);
        }

        const subscription = {
            regex: regex,
            observer: observer
        };

        this.subscriptions.push(subscription);

        return subscription;
    }

    /**
     * Unsubscribe an observer or subscription
     * @param {Object|Function} subscriptionOrObserver - Either a subscription object returned from sub() or an observer function
     * @returns {boolean} True if unsubscribed, false if not found
     */
    unsub(subscriptionOrObserver) {
        if (!subscriptionOrObserver) {
            return false;
        }

        const initialLength = this.subscriptions.length;

        // If it's a subscription object (has regex and observer properties)
        if (subscriptionOrObserver.regex && subscriptionOrObserver.observer) {
            this.subscriptions = this.subscriptions.filter(sub => sub !== subscriptionOrObserver);
        }
        // If it's an observer function
        else if (typeof subscriptionOrObserver === 'function') {
            this.subscriptions = this.subscriptions.filter(sub => sub.observer !== subscriptionOrObserver);
        }

        return this.subscriptions.length < initialLength;
    }

    /**
     * Publish an event to all matching subscribers
     * @param {string} eventName - Name of the event to publish
     * @param {*} data - Data to pass to observers (typically an object)
     */
    pub(eventName, data) {
        if (!eventName || typeof eventName !== 'string') {
            throw new Error("Event name must be a non-empty string");
        }

        // Find all subscriptions whose regex matches the event name
        const matchingSubscriptions = this.subscriptions.filter(sub => {
            try {
                return sub.regex.test(eventName);
            } catch (e) {
                this.logger?.error?.(`Error testing regex for event ${eventName}:`, e);
                return false;
            }
        });

        // Call each matching observer
        matchingSubscriptions.forEach(sub => {
            try {
                sub.observer(eventName, data);
            } catch (e) {
                this.logger?.error?.(`Error calling observer for event ${eventName}:`, e);
            }
        });
    }

    bindHandlers(ctx){
        this.logger.info("bindHandlers");
        let h = () => {
            try{

                ctx.overlayController.handleScaleChange()
            }
            catch(e){
                console.trace();
            }
        };

        ctx.simulator.onviewscalechanged = () => {
            h();
            // Emit circuit view scale changed event
            ctx.pub('circuit:view:scaled', {
                timestamp: Date.now()
            });
        };

        ctx.simulator.onelementsdragged = () => {
            h();
            // Emit elements dragged event
            ctx.pub('circuit:elements:dragged', {
                timestamp: Date.now()
            });
        };

        ctx.simulator.oncircuitcentered = () => {
            h();
            // Emit circuit centered event
            ctx.pub('circuit:view:centered', {
                timestamp: Date.now()
            });
        };

        ctx.simulator.oncircuitread = (file)=>{
            // Create new circuit model BEFORE building steps to ensure sync
            ctx.circuitModel = new CircuitModel(ctx);

            ctx.overlayController.handleCircuitRead(file);
            ctx.breadboard.clear();
            ctx.buildStrategy.reset();

            // Update BOM in store if in build mode - views will sync automatically via events
            if(ctx.bomView){
                ctx.store.set("bom", ctx.circuitModel.asBOM());
            }

            ctx.buildStrategy.buildSteps();

            // Emit circuit loaded event
            const isEmpty = !ctx.circuitModel || !ctx.circuitModel.components || ctx.circuitModel.components.length === 0;
            if (isEmpty) {
                ctx.pub('circuit:cleared', {
                    timestamp: Date.now()
                });
            } else {
                ctx.pub('circuit:loaded', {
                    file: file,
                    circuitModel: ctx.circuitModel,
                    componentCount: ctx.circuitModel.components ? ctx.circuitModel.components.length : 0,
                    timestamp: Date.now()
                });
            }
        };
    }

    initializeServices (ctx){
        this.logger.info("initializeServices", ctx);

        ctx.breadboard.render();

        ctx.breadboard.setCtx(ctx);
        ctx.overlayController.setCtx(ctx);
        ctx.buildStrategy.setCtx(ctx);
        ctx.dbtsMenuController.setCtx(ctx);
        ctx.aceController.setCtx(ctx);
        ctx.debuggerSimulatorSync.setCtx(ctx);

        // Initialize project manager
        ctx.projectManager.initialize().catch(err => {
            this.logger.error('Failed to initialize project manager:', err);
        });

        // Initialize project UI controller
        ctx.projectUIController = new ProjectUIController(ctx.projectManager);
        ctx.projectUIController.initialize();

        ctx.dbtsMenuController.designMode();
        // ctx.dbtsMenuController.buildMode();
        ctx.gutter.controls.adjust();

        ctx.simulator.setSimRunning(false);
    }

    circuitLoadListener(ctx){
        this.logger.info("circuitLoadListener", ctx);
        // Note: Circuit model and BOM sync are now handled in oncircuitread
        // This listener is kept for any additional post-load processing
        // The CircuitModel should already be created by oncircuitread handler
    }

    createCtx(ctx){

        this.logger.info("createCtx", ctx);

        ctx = ctx || {store: new ObservableMap(this)};
        if (!ctx.store) {
            ctx.store = new ObservableMap(this);
        }
        this.gutterSel = ctx.gutterSel || ".gutter";
        this.gutterControlsSel = ctx.gutterControlsSel || "#gutter-buttons";
        const split = Split(["#west-pane", "#east-pane"], {minSize: 0, gutterSize: 15});
        const gutterController = new GutterController(split, this.gutterSel, this.gutterControlsSel)

        let configs = {

            simulator:          $("#circuitFrame")[0].contentWindow.CircuitJS1,

            simulatorFrame :    $("#circuitFrame"),
            simulatorWindow :   $("#circuitFrame")[0].contentWindow,
            simulatorView :     $("#circuitFrame").contents().find("body"),
            simulatorCanvas :   $("#circuitFrame").contents().find("canvas"),

            overlayController:  new OverlayController(),

            code:               $("#code")[0].contentWindow.Ace,
            aceController:      new AceController(),

            bom:                $("#bom", $("#circuitFrame").contents()),
            breadboard:         new Breadboard("#breadboard"),
            buildStrategy:      new ComponentFocusedTutorialStrategy(),
            circuitModel:       new CircuitModel(ctx),

            split:              split,
            gutter:             gutterController,

            dbtsMenuController: new DBTSMenuController(gutterController, "#dbts-menu", ".dbts-btn"),

            debuggerSimulatorSync: new DebuggerSimulatorSyncController(),

            projectManager:     new ProjectManager(ctx),
            projectUIController: null, // Will be initialized after projectManager

            stepContentView:    $("#step-content"),
            stepControls:       $("#step-controls")
        };

        Object.assign(ctx, configs);

        // Expose pub/sub methods on the context so components can use application.sub/pub/unsub
        ctx.pub = this.pub.bind(this);
        ctx.sub = this.sub.bind(this);
        ctx.unsub = this.unsub.bind(this);

        this.logger.info("createCtx returning", ctx)

        // only used for debugging.  Need to wrap in a CLI arg or something.
        window.application = ctx;

        return ctx;
    }

    pageReady(){

        this.logger.info("pageReady()");

        let ctx = this.createCtx();

        // Expose ctx for access from HTML
        this.ctx = ctx;

        if(ctx.simulator){
            this.logger.info("initializing pithagoras with config", ctx);
            this.bindHandlers(ctx);
            this.initializeServices(ctx);
            ctx.simulatorWindow.oncircuitjsloaded = ()=> this.circuitLoadListener(ctx);
        }

        // Initialize circuit menu
        this.initCircuitMenu();
    }

    async initCircuitMenu() {
        const logger = new Logger("initCircuitMenu");
        const circuitMenuBuilder = new CircuitMenuBuilder();

        try {
            logger.info("Loading circuits menu...");
            const menuData = await circuitMenuBuilder.loadSetupList();
            const dropdown = document.getElementById('circuits-dropdown-content');

            if (!dropdown) {
                logger.error("Circuits dropdown element not found");
                return;
            }

            dropdown.innerHTML = circuitMenuBuilder.buildDropdownHTML(menuData);
            logger.info("Circuits menu loaded successfully with", menuData.children.length, "items");

            // Toggle dropdown on button click
            const menuBtn = document.getElementById('circuits-menu-btn');
            if (menuBtn) {
                logger.info("Attaching click handler to circuits menu button");
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    logger.info("Circuits menu button clicked, toggling dropdown");

                    const isShowing = dropdown.classList.toggle('show');

                    if (isShowing) {
                        // Position dropdown below the button using fixed positioning
                        const rect = menuBtn.getBoundingClientRect();
                        dropdown.style.top = (rect.bottom + 4) + 'px';
                        dropdown.style.left = rect.left + 'px';
                        logger.info("Positioned dropdown at top:", dropdown.style.top, "left:", dropdown.style.left);
                    }
                });
            } else {
                logger.error("Circuits menu button not found");
            }

            // Handle submenu clicks (toggle open/close)
            dropdown.addEventListener('click', (e) => {
                const submenuTitle = e.target.closest('.circuit-submenu-title');
                if (submenuTitle) {
                    e.stopPropagation();
                    const submenu = submenuTitle.closest('.circuit-submenu');
                    submenu.classList.toggle('open');
                    logger.info("Toggled submenu:", submenuTitle.textContent);
                }

                // Handle circuit item clicks
                const menuItem = e.target.closest('.circuit-menu-item');
                if (menuItem) {
                    const filename = menuItem.getAttribute('data-filename');
                    const title = menuItem.getAttribute('data-title');
                    if (filename && title) {
                        logger.info("Circuit item clicked:", title);
                        window.loadCircuit(filename, title);
                    }
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.circuits-dropdown')) {
                    dropdown.classList.remove('show');
                }
            });
        } catch (err) {
            logger.error('Failed to load circuits menu:', err);
        }
    }
}