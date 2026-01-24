import { BaseUIController } from './BaseUIController.js';
import { TemplateRegistry, generateInstanceId } from '../TemplateRegistry.js';
import { tabNavigationTemplate } from '../templates/tab-navigation-template.js';

/**
 * TabNavigationUIController - Manages tab switching in the debugger UI
 *
 * Supports two modes:
 * 1. Standalone: Generates its own HTML from template with registered tabs
 * 2. Embedded: Uses existing HTML in the DOM
 *
 * @example
 * // Standalone with tabs
 * const tabNav = new TabNavigationUIController({
 *     tabs: [
 *         { name: 'console', label: 'Console', paneId: 'console-tab-pane' },
 *         { name: 'callstack', label: 'Call Stack', paneId: 'callstack-tab-pane' }
 *     ]
 * });
 * tabNav.mount('.content');
 * tabNav.initialize();
 *
 * // Embedded with existing HTML
 * const tabNav = new TabNavigationUIController({
 *     skipRender: true
 * });
 * tabNav.initialize();
 */
export class TabNavigationUIController extends BaseUIController {
    constructor(config = {}) {
        super();

        const instanceId = config.instanceId || generateInstanceId('tab-nav');

        this.instanceId = instanceId;
        this.debuggerUI = config.debuggerUI || null;
        this.skipRender = config.skipRender || false;
        this.logger = new Logger("TabNavigationUIController");

        // Tab registry: Map<tabName, { label, paneId, active }>
        this.tabs = new Map();

        // Register initial tabs if provided
        if (config.tabs && Array.isArray(config.tabs)) {
            config.tabs.forEach((tab, index) => {
                this.registerTab(tab.name, tab.label, tab.paneId, index === 0);
            });
        }

        // Store references (will be set after render/mount)
        this.$container = null;
    }

    /**
     * Register a tab
     * @param {string} name - Tab name (used in data-tab attribute)
     * @param {string} label - Display label for the tab button
     * @param {string} paneId - ID of the tab pane element
     * @param {boolean} active - Whether this tab should be active initially
     */
    registerTab(name, label, paneId, active = false) {
        this.tabs.set(name, { label, paneId, active });
    }

    /**
     * Unregister a tab
     * @param {string} name - Tab name to unregister
     */
    unregisterTab(name) {
        this.tabs.delete(name);
    }

    /**
     * Render HTML from template
     * @returns {string} HTML string
     */
    render() {
        const template = TemplateRegistry.get('tab-navigation') || tabNavigationTemplate;

        const tabsArray = Array.from(this.tabs.entries()).map(([name, config]) => ({
            name,
            label: config.label,
            active: config.active
        }));

        return template({ tabs: tabsArray }, this.instanceId);
    }

    /**
     * Mount the tab navigation into a DOM container
     * @param {string|jQuery} container - Container for tab navigation
     */
    mount(container) {
        if (this.skipRender) {
            // Use existing HTML
            this.$container = $(`#${this.instanceId}`);
            if (this.$container.length === 0) {
                this.$container = $('.tab-nav').first();
            }

            // Auto-discover tabs from existing HTML
            this.discoverTabs();
            return;
        }

        const html = this.render();
        $(container).prepend(html);
        this.$container = $(`#${this.instanceId}`);
    }

    /**
     * Auto-discover tabs from existing HTML
     * Scans for .tab-btn elements and registers them
     */
    discoverTabs() {
        this.$container.find('.tab-btn').each((index, btn) => {
            const $btn = $(btn);
            const name = $btn.data('tab');
            const label = $btn.text().trim();
            const active = $btn.hasClass('active');

            // Try to find corresponding pane
            let paneId = null;
            if (name === 'console') {
                paneId = 'console-tab-pane';
            } else if (name === 'callstack') {
                paneId = 'callstack-tab-pane';
            } else if (name === 'breakpoints') {
                paneId = 'breakpoints-tab-pane';
            } else {
                paneId = `tab-${name}`;
            }

            this.registerTab(name, label, paneId, active);
        });
    }

    /**
     * Switch to a specific tab
     * @param {string} tabName - The name of the tab to switch to
     */
    switchToTab(tabName) {
        const tabConfig = this.tabs.get(tabName);
        if (!tabConfig) {
            this.logger.warn(`Tab "${tabName}" not found`);
            return;
        }

        // Update active tab button
        this.$container.find('.tab-btn').removeClass('active');
        this.$container.find(`.tab-btn[data-tab="${tabName}"]`).addClass('active');

        // Update active tab pane
        $('.tab-pane').removeClass('active');
        $(`#${tabConfig.paneId}`).addClass('active');

        // Update internal state
        this.tabs.forEach((config, name) => {
            config.active = (name === tabName);
        });
    }

    /**
     * Setup event handlers for tab navigation
     */
    setupEventHandlers() {
        this.$container.on('click', '.tab-btn', (e) => {
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