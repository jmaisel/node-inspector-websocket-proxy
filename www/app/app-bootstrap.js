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
     * @returns {Promise<void>}
     */
    async initializeServices(ctx) {
        this.logger.info('initializeServices', ctx);

        ctx.pub('application:init:breadboard', { timestamp: Date.now() });
        ctx.breadboard.render();

        ctx.pub('application:init:controllers', { timestamp: Date.now() });
        ctx.breadboard.setCtx(ctx);
        ctx.overlayController.setCtx(ctx);
        ctx.buildStrategy.setCtx(ctx);
        ctx.dbtsMenuController.setCtx(ctx);
        ctx.aceController.setCtx(ctx);
        ctx.debuggerSimulatorSync.setCtx(ctx);

        // Wait for AceController to complete async initialization
        ctx.pub('application:init:editor', { timestamp: Date.now() });
        if (ctx.aceController.waitForInitialization) {
            await ctx.aceController.waitForInitialization();
        }

        // Initialize project manager and wait for it to complete
        ctx.pub('application:init:project', { timestamp: Date.now() });
        try {
            await ctx.projectManager.initialize();
            this.logger.info('Project manager initialized successfully');
        } catch (err) {
            this.logger.error('Failed to initialize project manager:', err);
        }

        // Initialize project UI controller
        ctx.projectUIController = new ProjectUIController(ctx.projectManager);
        ctx.projectUIController.initialize();

        // Initialize file tree controller
        ctx.pub('application:init:filetree', { timestamp: Date.now() });
        ctx.fileTreeController.setCtx(ctx);
        ctx.fileTreeController.initialize();

        // Initialize toolbar controller
        ctx.pub('application:init:toolbar', { timestamp: Date.now() });
        ctx.toolbarController.setCtx(ctx);
        ctx.toolbarController.initialize();

        ctx.pub('application:init:layout', { timestamp: Date.now() });
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
     * Update splash screen status message
     * @param {string} message - Status message to display
     */
    updateSplashStatus(message) {
        const statusEl = document.querySelector('.splash-status');
        if (statusEl) {
            statusEl.textContent = message;
            this.logger.debug('Splash status:', message);
        }
    }

    /**
     * Show splash screen and subscribe to initialization events
     */
    showSplashScreen() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.display = 'flex';
            splash.classList.remove('fade-out');
            this.logger.info('Splash screen shown');
        }

        // Subscribe to all events to show initialization progress
        this.splashEventSubscription = this.sub(/.*/, (eventName, data) => {
            // Map event names to user-friendly messages
            const statusMessages = {
                'application:initializing': 'Starting application...',
                'application:init:simulator': 'Connecting to simulator...',
                'application:init:breadboard': 'Rendering breadboard...',
                'application:init:controllers': 'Initializing controllers...',
                'application:init:editor': 'Loading code editor...',
                'application:init:project': 'Loading project...',
                'application:init:filetree': 'Setting up file tree...',
                'application:init:toolbar': 'Configuring toolbar...',
                'application:init:layout': 'Adjusting layout...',
                'application:init:circuits': 'Loading circuits menu...',
                'application:init:menus': 'Setting up menus...',
                'application:init:splits': 'Configuring split views...',
                'circuit:loaded': 'Circuit loaded',
                'circuit:cleared': 'Circuit cleared',
                'mode:design:entered': 'Design mode ready',
                'mode:build:entered': 'Build mode ready',
                'debugger:connected': 'Debugger connected',
                'debugger:disconnected': 'Debugger disconnected',
                'project:loaded': 'Project loaded',
                'project:saved': 'Project saved',
                'theme:changed': 'Theme applied'
            };

            // Check for logger events (from Logger class)
            if (eventName.includes(':info') || eventName.includes(':log')) {
                // Extract component name and show relevant initialization messages
                const loggerMatch = eventName.match(/^(.+?):(info|log)$/);
                if (loggerMatch) {
                    const component = loggerMatch[1];
                    const componentMessages = {
                        'Pithagoras': 'Initializing core...',
                        'ProjectManager': 'Loading project manager...',
                        'AceControllerV2': 'Setting up code editor...',
                        'ConsoleUIController': 'Initializing console...',
                        'FileTreeController': 'Loading file tree...',
                        'ToolbarController': 'Setting up toolbar...',
                        'initCircuitMenu': 'Loading circuits menu...',
                        'ThemeSwitcher': 'Applying theme...'
                    };

                    if (componentMessages[component]) {
                        this.updateSplashStatus(componentMessages[component]);
                    }
                }
            }

            // Show mapped status messages
            if (statusMessages[eventName]) {
                this.updateSplashStatus(statusMessages[eventName]);
            }
        });
    }

    /**
     * Hide splash screen with fade out animation
     */
    hideSplashScreen() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            this.updateSplashStatus('Ready!');

            // Unsubscribe from splash events
            if (this.splashEventSubscription) {
                this.unsub(this.splashEventSubscription);
                this.splashEventSubscription = null;
            }

            splash.classList.add('fade-out');
            // Remove from DOM after animation completes
            setTimeout(() => {
                splash.style.display = 'none';
                this.logger.info('Splash screen hidden');
            }, 500);
        }
    }

    /**
     * Emit initialization started event and log
     */
    initializing() {
        this.logger.log("================= INITIALIZING PITHAGORAS V2 ==================");

        // Show splash screen
        this.showSplashScreen();

        // Emit application lifecycle event
        if (this.pub) {
            this.pub('application:initializing', {
                timestamp: Date.now(),
                version: 'v2'
            });
        }
    }

    /**
     * Emit initialization completed event and log
     */
    initialized() {
        this.logger.log("================= DONE INITIALIZING PITHAGORAS V2 ==================");

        // Hide splash screen
        this.hideSplashScreen();

        // Emit application lifecycle event
        if (this.pub) {
            this.pub('application:initialized', {
                timestamp: Date.now(),
                version: 'v2'
            });
        }
    }

    /**
     * Main initialization entry point
     * Orchestrates the complete application initialization sequence
     * @returns {Promise<void>}
     */
    async initialize() {
        this.logger.info('initialize()');

        // Emit initializing event
        this.initializing();

        // Clear any collapsed state
        localStorage.removeItem('console-collapsed');

        // Run the page initialization
        await this.pageReady();

        // Emit initialized event
        this.initialized();
    }

    /**
     * Initialize the application when the page is ready
     * @returns {Promise<void>}
     */
    async pageReady() {
        this.logger.info('pageReady()');

        let ctx = this.createCtx();

        // Expose ctx for access from HTML
        this.ctx = ctx;

        if (ctx.simulator) {
            this.logger.info('initializing pithagoras with config', ctx);
            ctx.pub('application:init:simulator', { timestamp: Date.now() });
            this.bindHandlers(ctx);
            await this.initializeServices(ctx);
            ctx.simulatorWindow.oncircuitjsloaded = () => this.circuitLoadListener(ctx);
        }

        // Initialize circuit menu (async)
        ctx.pub('application:init:circuits', { timestamp: Date.now() });
        await this.initCircuitMenu();

        // Initialize project menu
        ctx.pub('application:init:menus', { timestamp: Date.now() });
        this.initProjectMenu();

        // Initialize split views
        ctx.pub('application:init:splits', { timestamp: Date.now() });
        this.initSplitViews();
    }

    /**
     * Initialize split views for the application layout
     * Creates the console split and restores saved sizes
     */
    initSplitViews() {
        this.logger.info('Initializing split views');

        // Initialize vertical split for console
        const consoleSplit = Split(['#code-editor-container', '#console-panel'], {
            direction: 'vertical',
            sizes: [70, 30],
            minSize: [50, 28],
            gutterSize: 8,
            cursor: 'row-resize',
            snapOffset: 0,  // Disable snapping
            dragInterval: 1, // Update every pixel
            onDragEnd: function(sizes) {
                // Resize Ace editor after split drag
                if (window.application && window.application.fileTreeController) {
                    window.application.fileTreeController.resizeAceEditor();
                }
                // Store sizes
                localStorage.setItem('console-split-sizes', JSON.stringify(sizes));
            }
        });

        // Restore saved split sizes
        const savedSizes = localStorage.getItem('console-split-sizes');
        if (savedSizes) {
            try {
                consoleSplit.setSizes(JSON.parse(savedSizes));
            } catch (e) {
                this.logger.error("Failed to restore console split sizes:", e);
            }
        }

        // Pass split instance to console controller
        if (this.ctx && this.ctx.aceController && this.ctx.aceController.consoleController) {
            this.ctx.aceController.consoleController.setConsoleSplit(consoleSplit);
        }
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