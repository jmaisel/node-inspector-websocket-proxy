/**
 * ModeController (formerly DBTSMenuController) - Manages application mode switching
 *
 * Handles switching between Design and Build modes, managing the visibility
 * of related UI components and emitting mode change events.
 *
 * @class ModeController
 */
class DBTSMenuController {
    /**
     * Creates a new ModeController
     * @param {GutterController} gutterController - The gutter controller for layout adjustments
     * @param {string} dbtsMenuSel - CSS selector for the DBTS menu
     * @param {string} dbtsBtnSel - CSS selector for DBTS buttons
     */
    constructor(gutterController, dbtsMenuSel, dbtsBtnSel) {
        this.logger = new Logger('DBTSMenuController');

        this.logger.info('constructor', gutterController, dbtsMenuSel, dbtsBtnSel);

        this.dbtsMenuSel = dbtsMenuSel || '';
        this.dbtsBtnSel = dbtsBtnSel || '';
        this.gutterController = gutterController;

        this.bind();
    }

    /**
     * Set the application context
     * @param {Object} ctx - The application context containing services and state
     */
    setCtx(ctx) {
        this.logger.info('setCtx', ctx);
        this.application = ctx;
        this.buildStrategy = this.application.buildStrategy;
    }

    /**
     * Switch to Design mode
     * Hides build-related UI (breadboard, BOM) and clears overlays
     */
    designMode() {
        this.logger.info('designMode()');

        // Get previous mode before switching
        const previousMode = this.application.store.get('mode') || null;
        const timestamp = Date.now();

        // Emit exit event for previous mode if there was one
        if (previousMode && previousMode !== 'design') {
            this.application.pub(`mode:${previousMode}:exited`, { timestamp });
        }

        this.application.bom.fadeOut();
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

    /**
     * Switch to Build mode
     * Shows breadboard and BOM, builds tutorial steps
     */
    buildMode() {
        this.logger.info('buildMode()');

        // Get previous mode before switching
        const previousMode = this.application.store.get('mode') || null;
        const timestamp = Date.now();

        // Emit exit event for previous mode if there was one
        if (previousMode && previousMode !== 'build') {
            this.application.pub(`mode:${previousMode}:exited`, { timestamp });
        }

        this.application.overlayController.setCtx(this.application);

        this.logger.info('buildMode: building steps, showing breadboard and BOM');

        if (!this.application.bomView) {
            this.application.bomView = new Inspector('#bom-inspector', this.application);
        }

        // Ensure circuit model exists before building steps
        if (!this.application.circuitModel) {
            this.application.circuitModel = new CircuitModel(this.application);
        }

        // Update BOM in store - views will sync automatically via events
        let bom = this.application.circuitModel.asBOM();
        this.application.store.set('bom', bom);

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

    /**
     * Bind event handlers to mode buttons
     */
    bind() {
        this.logger.info('bind()');

        this.dbtsMenu = $(this.dbtsMenuSel);
        this.dbtsBtns = $(this.dbtsBtnSel);

        this.dbtsBtns.click((e) => {
            // Use currentTarget to get the button, not the child element that was clicked
            const cmd = $(e.currentTarget).attr('cmd');
            this.logger.info('Button clicked with cmd:', cmd);

            switch (cmd) {
                case 'design':
                    this.designMode();
                    break;

                case 'build':
                    this.buildMode();
                    break;

                case 'test':
                    // Test mode not yet implemented
                    break;

                case 'share':
                    // Share mode not yet implemented
                    break;
            }

            // Close the mode dropdown menu
            $('.mode-dropdown-content').removeClass('show');
        });
    }
}