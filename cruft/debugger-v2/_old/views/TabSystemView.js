import { BaseView } from '../core/BaseView.js';
import { tabSystemTemplate } from '../templates/tab-system-template.js';

/**
 * TabSystemView - Manages tab navigation
 *
 * Handles tab switching between different panels:
 * - Console
 * - Call Stack
 * - Files
 * - Breakpoints
 * - Watches
 * - Scope
 */
export class TabSystemView extends BaseView {
    constructor(config = {}) {
        super(config);

        // Default state
        if (!this.state.activeTab) {
            this.state.activeTab = 'console';
        }

        if (!this.state.tabs) {
            this.state.tabs = [
                { id: 'console', label: 'Console', visible: true },
                { id: 'callstack', label: 'Call Stack', visible: true },
                { id: 'files', label: 'Files', visible: true },
                { id: 'breakpoints', label: 'Breakpoints', visible: true },
                { id: 'watches', label: 'Watches', visible: true },
                { id: 'scope', label: 'Scope', visible: true }
            ];
        }
    }

    /**
     * Define element map
     * @returns {Object} Element map
     */
    defineElementMap() {
        const elements = {
            container: '',
            navContainer: '-nav',
            contentContainer: '-content',
            tabs: {},
            panes: {}
        };

        // Add tab buttons and panes for each tab
        this.state.tabs.forEach(tab => {
            elements.tabs[tab.id] = `-tab-${tab.id}`;
            elements.panes[tab.id] = `-pane-${tab.id}`;
        });

        return elements;
    }

    /**
     * Get default template
     * @returns {Function} Template function
     */
    getDefaultTemplate() {
        return tabSystemTemplate;
    }

    /**
     * Attach event handlers
     */
    async attachEvents() {
        const elements = this.getElementMap();

        // Tab button clicks
        Object.entries(elements.tabs).forEach(([tabId, tabElement]) => {
            if (tabElement) {
                this.registerEventHandler(
                    tabElement,
                    'click',
                    () => this.switchToTab(tabId)
                );
            }
        });
    }

    /**
     * Switch to a specific tab
     * @param {string} tabId - Tab ID to switch to
     */
    switchToTab(tabId) {
        // Update state
        this.setState({ activeTab: tabId });

        // Update UI
        const elements = this.getElementMap();

        // Remove active class from all tabs and panes
        Object.values(elements.tabs).forEach(el => {
            if (el) $(el).removeClass('active');
        });
        Object.values(elements.panes).forEach(el => {
            if (el) $(el).removeClass('active');
        });

        // Add active class to selected tab and pane
        if (elements.tabs[tabId]) {
            $(elements.tabs[tabId]).addClass('active');
        }
        if (elements.panes[tabId]) {
            $(elements.panes[tabId]).addClass('active');
        }

        // Emit custom event
        this.onTabChanged(tabId);
    }

    /**
     * Get currently active tab ID
     * @returns {string} Active tab ID
     */
    getActiveTab() {
        return this.state.activeTab;
    }

    /**
     * Get pane element for a specific tab
     * @param {string} tabId - Tab ID
     * @returns {jQuery} Pane element
     */
    getPane(tabId) {
        const elements = this.getElementMap();
        return $(elements.panes[tabId]);
    }

    /**
     * Set tab visibility
     * @param {string} tabId - Tab ID
     * @param {boolean} visible - Whether tab should be visible
     */
    setTabVisibility(tabId, visible) {
        const elements = this.getElementMap();
        const tabElement = elements.tabs[tabId];

        if (tabElement) {
            if (visible) {
                $(tabElement).show();
            } else {
                $(tabElement).hide();

                // If hiding the active tab, switch to first visible tab
                if (this.state.activeTab === tabId) {
                    const firstVisibleTab = this.state.tabs.find(t => t.visible !== false && t.id !== tabId);
                    if (firstVisibleTab) {
                        this.switchToTab(firstVisibleTab.id);
                    }
                }
            }
        }
    }

    /**
     * Hook called when tab changes
     * Override in subclass or listen to this event
     * @param {string} tabId - New active tab ID
     */
    onTabChanged(tabId) {
        // Subclasses can override or controllers can listen
        // Emit jQuery event for external listeners
        if (this.$element) {
            this.$element.trigger('tab-changed', { tabId });
        }
    }

    /**
     * Add content to a specific pane
     * @param {string} tabId - Tab ID
     * @param {string|jQuery} content - Content to add
     */
    addToPane(tabId, content) {
        const $pane = this.getPane(tabId);
        if ($pane && $pane.length > 0) {
            $pane.append(content);
        }
    }

    /**
     * Clear content from a specific pane
     * @param {string} tabId - Tab ID
     */
    clearPane(tabId) {
        const $pane = this.getPane(tabId);
        if ($pane && $pane.length > 0) {
            $pane.empty();
        }
    }

    /**
     * Clear all panes
     */
    clearAllPanes() {
        this.state.tabs.forEach(tab => {
            this.clearPane(tab.id);
        });
    }
}
