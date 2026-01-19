/**
 * Pithagoras - Main application bootstrap and coordinator
 *
 * This class is responsible for:
 * - Initializing the application context and all services
 * - Providing a pub/sub event system for component communication
 * - Binding simulator event handlers
 * - Managing circuit and project menus
 * - Coordinating the overall application lifecycle
 *
 * @class Pithagoras
 */
class Pithagoras {
    /**
     * Creates a new Pithagoras application instance
     * @param {Object} ctx - Optional initial context object
     */
    constructor(ctx) {
        this.logger = new Logger('Pithagoras');
        this.ctx = ctx || {};

        // Initialize pub/sub system
        this.subscriptions = [];

        // Add array utility method for removing objects by value
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
            throw new Error('Pattern is required for subscription');
        }

        if (typeof observer !== 'function') {
            throw new Error('Observer must be a function');
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
            throw new Error('Event name must be a non-empty string');
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

    /**
     * Bind simulator event handlers
     * @param {Object} ctx - Application context
     */
    bindHandlers(ctx) {
        this.logger.info('bindHandlers');
        let h = () => {
            try {
                ctx.overlayController.handleScaleChange();
            }
            catch (e) {
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

        ctx.simulator.oncircuitread = (file) => {
            // Create new circuit model BEFORE building steps to ensure sync
            ctx.circuitModel = new CircuitModel(ctx);

            ctx.overlayController.handleCircuitRead(file);
            ctx.breadboard.clear();
            ctx.buildStrategy.reset();

            // Update BOM in store if in build mode - views will sync automatically via events
            if (ctx.bomView) {
                ctx.store.set('bom', ctx.circuitModel.asBOM());
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

    /**
     * Initialize all application services
     * @param {Object} ctx - Application context
     */
    initializeServices(ctx) {
        this.logger.info('initializeServices', ctx);

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

        // Initialize file tree controller
        ctx.fileTreeController.setCtx(ctx);
        ctx.fileTreeController.initialize();

        // Initialize toolbar controller
        ctx.toolbarController.setCtx(ctx);
        ctx.toolbarController.initialize();

        ctx.dbtsMenuController.designMode();
        ctx.gutter.controls.adjust();

        ctx.simulator.setSimRunning(false);
    }

    /**
     * Circuit load listener callback
     * @param {Object} ctx - Application context
     */
    circuitLoadListener(ctx) {
        this.logger.info('circuitLoadListener', ctx);
        // Note: Circuit model and BOM sync are now handled in oncircuitread
        // This listener is kept for any additional post-load processing
        // The CircuitModel should already be created by oncircuitread handler
    }

    /**
     * Create and configure the application context
     * @param {Object} ctx - Optional initial context
     * @returns {Object} The configured application context
     */
    createCtx(ctx) {
        this.logger.info('createCtx', ctx);

        ctx = ctx || { store: new ObservableMap(this) };
        if (!ctx.store) {
            ctx.store = new ObservableMap(this);
        }
        this.gutterSel = ctx.gutterSel || '.gutter';
        this.gutterControlsSel = ctx.gutterControlsSel || '#gutter-buttons';
        const split = Split(['#west-pane', '#east-pane'], { minSize: 0, gutterSize: 15 });
        const gutterController = new GutterController(split, this.gutterSel, this.gutterControlsSel);

        let configs = {

            simulator: $('#circuitFrame')[0].contentWindow.CircuitJS1,

            simulatorFrame: $('#circuitFrame'),
            simulatorWindow: $('#circuitFrame')[0].contentWindow,
            simulatorView: $('#circuitFrame').contents().find('body'),
            simulatorCanvas: $('#circuitFrame').contents().find('canvas'),

            overlayController: new OverlayController(),

            code: $('#code')[0].contentWindow.Ace,
            aceController: new AceController(),

            bom: $('#bom', $('#circuitFrame').contents()),
            breadboard: new Breadboard('#breadboard'),
            buildStrategy: new ComponentFocusedTutorialStrategy(),
            circuitModel: new CircuitModel(ctx),

            split: split,
            gutter: gutterController,

            dbtsMenuController: new DBTSMenuController(gutterController, '#dbts-menu', '.dbts-btn'),

            debuggerSimulatorSync: new DebuggerSimulatorSyncController(),

            projectManager: new ProjectManager(ctx),
            projectUIController: null, // Will be initialized after projectManager

            fileTreeController: new FileTreeController(),
            toolbarController: new ToolbarController(),

            stepContentView: $('#step-content'),
            stepControls: $('#step-controls')
        };

        Object.assign(ctx, configs);

        // Expose pub/sub methods on the context so components can use application.sub/pub/unsub
        ctx.pub = this.pub.bind(this);
        ctx.sub = this.sub.bind(this);
        ctx.unsub = this.unsub.bind(this);

        this.logger.info('createCtx returning', ctx);

        // Only used for debugging. Need to wrap in a CLI arg or something.
        window.application = ctx;

        return ctx;
    }

    /**
     * Initialize the application when the page is ready
     */
    pageReady() {
        this.logger.info('pageReady()');

        let ctx = this.createCtx();

        // Expose ctx for access from HTML
        this.ctx = ctx;

        if (ctx.simulator) {
            this.logger.info('initializing pithagoras with config', ctx);
            this.bindHandlers(ctx);
            this.initializeServices(ctx);
            ctx.simulatorWindow.oncircuitjsloaded = () => this.circuitLoadListener(ctx);
        }

        // Initialize circuit menu
        this.initCircuitMenu();

        // Initialize project menu
        this.initProjectMenu();
    }

    /**
     * Initialize the circuits dropdown menu
     * @returns {Promise<void>}
     */
    async initCircuitMenu() {
        const logger = new Logger('initCircuitMenu');
        const circuitMenuBuilder = new CircuitMenuBuilder();

        try {
            logger.info('Loading circuits menu...');
            const menuData = await circuitMenuBuilder.loadSetupList();
            const dropdown = document.getElementById('circuits-dropdown-content');

            if (!dropdown) {
                logger.error('Circuits dropdown element not found');
                return;
            }

            dropdown.innerHTML = circuitMenuBuilder.buildDropdownHTML(menuData);
            logger.info('Circuits menu loaded successfully with', menuData.children.length, 'items');

            // Toggle dropdown on button click
            const menuBtn = document.getElementById('circuits-menu-btn');
            if (menuBtn) {
                logger.info('Attaching click handler to circuits menu button');
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    logger.info('Circuits menu button clicked, toggling dropdown');

                    const isShowing = dropdown.classList.toggle('show');

                    if (isShowing) {
                        // Position dropdown below the button using fixed positioning
                        const rect = menuBtn.getBoundingClientRect();
                        dropdown.style.top = (rect.bottom + 4) + 'px';
                        dropdown.style.left = rect.left + 'px';
                        logger.info('Positioned dropdown at top:', dropdown.style.top, 'left:', dropdown.style.left);
                    }
                });
            } else {
                logger.error('Circuits menu button not found');
            }

            // Handle submenu clicks (toggle open/close)
            dropdown.addEventListener('click', (e) => {
                const submenuTitle = e.target.closest('.circuit-submenu-title');
                if (submenuTitle) {
                    e.stopPropagation();
                    const submenu = submenuTitle.closest('.circuit-submenu');
                    submenu.classList.toggle('open');
                    logger.info('Toggled submenu:', submenuTitle.textContent);
                }

                // Handle circuit item clicks
                const menuItem = e.target.closest('.circuit-menu-item');
                if (menuItem) {
                    const filename = menuItem.getAttribute('data-filename');
                    const title = menuItem.getAttribute('data-title');
                    if (filename && title) {
                        logger.info('Circuit item clicked:', title);
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

    /**
     * Initialize the project dropdown menu
     */
    initProjectMenu() {
        const logger = new Logger('initProjectMenu');

        const projectMenuBtn = document.getElementById('project-menu-btn');
        const projectDropdown = document.getElementById('project-dropdown-content');

        if (!projectMenuBtn || !projectDropdown) {
            logger.error('Project menu elements not found');
            return;
        }

        // Toggle dropdown on button click
        projectMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            logger.info('Project menu button clicked');

            const isShowing = projectDropdown.classList.toggle('show');

            if (isShowing) {
                // Position dropdown below the button using fixed positioning
                const rect = projectMenuBtn.getBoundingClientRect();
                projectDropdown.style.top = (rect.bottom + 4) + 'px';
                projectDropdown.style.left = rect.left + 'px';
                logger.info('Positioned project dropdown at top:', projectDropdown.style.top, 'left:', projectDropdown.style.left);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.project-dropdown')) {
                projectDropdown.classList.remove('show');
            }
        });

        // Wire up menu items to existing button handlers
        const menuItemMappings = [
            { menuId: 'project-new-btn-menu', buttonId: 'project-new-btn' },
            { menuId: 'project-open-btn-menu', buttonId: 'project-open-btn' },
            { menuId: 'project-save-btn-menu', buttonId: 'project-save-btn' },
            { menuId: 'project-import-btn-menu', buttonId: 'project-import-btn' },
            { menuId: 'project-export-btn-menu', buttonId: 'project-export-btn' }
        ];

        menuItemMappings.forEach(mapping => {
            const menuItem = document.getElementById(mapping.menuId);
            const targetButton = document.getElementById(mapping.buttonId);

            if (menuItem && targetButton) {
                menuItem.addEventListener('click', () => {
                    logger.info('Menu item clicked:', mapping.menuId);
                    // Trigger click on the actual button to maintain existing functionality
                    targetButton.click();
                    // Close dropdown
                    projectDropdown.classList.remove('show');
                });
            } else {
                logger.warn('Could not wire up menu item:', mapping.menuId, 'to button:', mapping.buttonId);
            }
        });

        logger.info('Project menu initialized successfully');
    }
}