import { TabSystemView } from '../views/TabSystemView.js';

/**
 * TabSystemController - Controls tab navigation
 *
 * Business logic for tab switching and management.
 * Uses TabSystemView for rendering.
 */
export class TabSystemController {
    constructor(config = {}) {
        this.config = config;
        this.view = new TabSystemView({
            container: config.container,
            initialState: {
                activeTab: config.activeTab || 'console',
                tabs: config.tabs || null
            }
        });

        this.listeners = [];
    }

    /**
     * Initialize the controller
     */
    async initialize() {
        // Mount the view
        await this.view.mount();

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen to tab change events from view
        this.view.getElement().on('tab-changed', (event, data) => {
            this.onTabChanged(data.tabId);
        });
    }

    /**
     * Called when tab changes
     * @param {string} tabId - New active tab ID
     */
    onTabChanged(tabId) {
        // Notify registered listeners
        this.listeners.forEach(listener => {
            if (typeof listener === 'function') {
                listener(tabId);
            }
        });
    }

    /**
     * Register a tab change listener
     * @param {Function} callback - Callback function (tabId) => void
     */
    onTabChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * Switch to a specific tab
     * @param {string} tabId - Tab ID to switch to
     */
    switchToTab(tabId) {
        this.view.switchToTab(tabId);
    }

    /**
     * Get currently active tab ID
     * @returns {string} Active tab ID
     */
    getActiveTab() {
        return this.view.getActiveTab();
    }

    /**
     * Get pane element for a specific tab
     * @param {string} tabId - Tab ID
     * @returns {jQuery} Pane element
     */
    getPane(tabId) {
        return this.view.getPane(tabId);
    }

    /**
     * Set tab visibility
     * @param {string} tabId - Tab ID
     * @param {boolean} visible - Whether tab should be visible
     */
    setTabVisibility(tabId, visible) {
        this.view.setTabVisibility(tabId, visible);
    }

    /**
     * Add content to a specific pane
     * @param {string} tabId - Tab ID
     * @param {string|jQuery} content - Content to add
     */
    addToPane(tabId, content) {
        this.view.addToPane(tabId, content);
    }

    /**
     * Clear content from a specific pane
     * @param {string} tabId - Tab ID
     */
    clearPane(tabId) {
        this.view.clearPane(tabId);
    }

    /**
     * Get the view instance
     * @returns {TabSystemView} View instance
     */
    getView() {
        return this.view;
    }

    /**
     * Destroy the controller
     */
    destroy() {
        this.listeners = [];
        this.view.unmount();
    }
}
