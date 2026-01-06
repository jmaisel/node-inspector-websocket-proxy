import { ConsoleView } from '../views/ConsoleView.js';

/**
 * ConsoleController - Controls console functionality
 *
 * Business logic for:
 * - Log entry management
 * - Search filtering
 * - Auto-scroll management
 * - Dock/undock orchestration
 */
export class ConsoleController {
    constructor(config = {}) {
        this.config = config;
        this.view = new ConsoleView({
            container: config.container,
            initialState: {
                mode: config.mode || 'tabbed',
                logEntries: []
            }
        });
    }

    /**
     * Initialize the controller
     */
    async initialize() {
        // Mount the view
        await this.view.mount();

        // Expose log function globally if configured
        if (this.config.exposeGlobally) {
            window.log = (message, type) => this.log(message, type);
        }
    }

    /**
     * Log a message
     * @param {string} message - Message to log
     * @param {string} [type='info'] - Log type ('info', 'error', 'event')
     */
    log(message, type = 'info') {
        this.view.addLogEntry({ message, type });
    }

    /**
     * Clear console
     */
    clear() {
        this.view.clearLog();
    }

    /**
     * Undock console
     */
    undock() {
        this.view.undock();
    }

    /**
     * Dock console
     */
    dock() {
        this.view.dock();
    }

    /**
     * Get view instance
     * @returns {ConsoleView} View instance
     */
    getView() {
        return this.view;
    }

    /**
     * Destroy the controller
     */
    destroy() {
        // Remove global log function if exposed
        if (this.config.exposeGlobally && window.log) {
            delete window.log;
        }

        this.view.unmount();
    }
}
