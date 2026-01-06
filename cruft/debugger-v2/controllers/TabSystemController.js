/**
 * TabSystemController - Manages tab navigation
 *
 * Responsibilities:
 * - Render tab system from template (with TemplateRegistry override support)
 * - Handle tab switching
 * - Expose methods for other controllers to interact with tabs
 *
 * Features:
 * - 6 default tabs: Console, Call Stack, Files, Breakpoints, Watches, Scope
 * - Active tab state management
 * - Dynamic content injection into tab panes
 */

import { TemplateRegistry } from '../core/TemplateRegistry.js';
import { tabSystemTemplate } from '../templates/tab-system-template.js';

export class TabSystemController {
    constructor(config = {}) {
        this.eventQueue = config.eventQueue;
        this.proxy = config.proxy;
        this.container = config.container || '#tab-system';
        this.instanceId = config.instanceId || 'tab-system-' + Date.now();

        // State
        this.activeTab = 'console';
        this.tabs = [
            { id: 'console', label: 'Console', visible: true },
            { id: 'callstack', label: 'Call Stack', visible: true },
            { id: 'files', label: 'Files', visible: true },
            { id: 'breakpoints', label: 'Breakpoints', visible: true },
            { id: 'watches', label: 'Watches', visible: true },
            { id: 'scope', label: 'Scope', visible: true }
        ];

        console.log('[TabSystemController] Created');
    }

    /**
     * Initialize - render and setup
     */
    async initialize() {
        console.log('[TabSystemController] Initializing...');

        // Render the template
        this.render();

        // Setup event handlers
        this.setupDOMEventHandlers();

        console.log('[TabSystemController] Initialized');
    }

    /**
     * Render tab system from template (with TemplateRegistry override support)
     */
    render() {
        // Check TemplateRegistry first, fall back to default template
        const templateFn = TemplateRegistry.get('tab-system') || tabSystemTemplate;

        const html = templateFn({
            activeTab: this.activeTab,
            tabs: this.tabs
        }, {}, this.instanceId);

        // Insert into container
        $(this.container).html(html);

        console.log('[TabSystemController] Rendered to', this.container);
    }

    /**
     * Setup DOM event handlers (tab button clicks)
     */
    setupDOMEventHandlers() {
        // Tab button clicks
        $(`#${this.instanceId} .tab-btn`).on('click', (e) => {
            const tabId = $(e.currentTarget).data('tab');
            console.log('[TabSystemController] Tab clicked:', tabId);
            this.switchToTab(tabId);
        });

        console.log('[TabSystemController] DOM event handlers setup');
    }

    /**
     * Switch to a specific tab
     * @param {string} tabId - The ID of the tab to switch to
     */
    switchToTab(tabId) {
        console.log('[TabSystemController] Switching to tab:', tabId);

        // Update active state
        this.activeTab = tabId;

        // Update button states
        $(`#${this.instanceId} .tab-btn`).removeClass('active');
        $(`#${this.instanceId}-tab-${tabId}`).addClass('active');

        // Update pane states
        $(`#${this.instanceId}-content .tab-pane`).removeClass('active');
        $(`#${this.instanceId}-pane-${tabId}`).addClass('active');
    }

    /**
     * Set content for a specific tab pane
     * Useful for other controllers to inject their content
     * @param {string} tabId - The ID of the tab
     * @param {string} html - HTML content to set
     */
    setTabContent(tabId, html) {
        console.log('[TabSystemController] Setting content for tab:', tabId);
        $(`#${this.instanceId}-pane-${tabId}`).html(html);
    }

    /**
     * Get the current active tab ID
     * @returns {string} Active tab ID
     */
    getActiveTab() {
        return this.activeTab;
    }

    /**
     * Get the tab pane selector for a specific tab
     * @param {string} tabId - The ID of the tab
     * @returns {string} jQuery selector for the tab pane
     */
    getTabPaneSelector(tabId) {
        return `#${this.instanceId}-pane-${tabId}`;
    }
}
