import { BaseUIController } from './BaseUIController.js';

/**
 * TabNavigationUIController - Manages tab switching in the debugger UI
 */
export class TabNavigationUIController extends BaseUIController {
    constructor() {
        super();
    }

    /**
     * Switch to a specific tab
     * @param {string} tabName - The name of the tab to switch to
     */
    switchToTab(tabName) {
        // Update active tab button
        $('.tab-btn').removeClass('active');
        $(`.tab-btn[data-tab="${tabName}"]`).addClass('active');

        // Update active tab pane
        $('.tab-pane').removeClass('active');
        $(`#tab-${tabName}`).addClass('active');
    }

    /**
     * Setup event handlers for tab navigation
     */
    setupEventHandlers() {
        $('.tab-btn').click((e) => {
            const tab = $(e.currentTarget).data('tab');
            this.switchToTab(tab);
        });
    }

    /**
     * Initialize tab navigation
     */
    initialize() {
        this.setupEventHandlers();
    }
}