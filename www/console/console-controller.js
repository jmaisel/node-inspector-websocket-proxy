/**
 * ConsoleUIController - Orchestrates console functionality
 * Subscribes to debugger and application events
 * Handles filtering, detachment, and collapse/expand
 */
class ConsoleUIController {

    constructor() {
        this.logger = new Logger('ConsoleUIController');
        this.application = null;
        this.model = null;
        this.view = null;
        this.isDetached = false;
        this.detachedWindow = null;
        this.consoleSplit = null;

        // Events to filter out (too noisy)
        this.noisyEvents = [
            /^editor:cursor:moved$/,
            /^circuit:view:scaled$/,
            /^circuit:elements:dragged$/,
            /^breadboard:.*:hover$/
        ];

        // Batching for performance - only update display once per frame
        this.updateScheduled = false;
    }

    /**
     * Set application context
     * @param {Object} ctx - Application context
     */
    setCtx(ctx) {
        this.application = ctx;
        this.logger.info('Context set');
    }

    /**
     * Set model reference
     * @param {ConsoleUIModel} model
     */
    setModel(model) {
        this.model = model;
        this.logger.info('Model set');
    }

    /**
     * Set view reference
     * @param {ConsoleUIView} view
     */
    setView(view) {
        this.view = view;
        this.logger.info('View set');
    }

    /**
     * Initialize and bind event listeners
     */
    bind() {
        this.logger.info('Binding console UI controller');

        if (!this.application || !this.model || !this.view) {
            this.logger.error('Cannot bind - missing dependencies');
            return;
        }

        // Subscribe to debugger console events
        this.application.sub(/^debugger:console$/, (topic, data) => {
            this.handleDebuggerConsole(topic, data);
        });

        // Subscribe to all application events (with filtering)
        this.application.sub(/.*/, (topic, data) => {
            if (this.shouldLogEvent(topic)) {
                this.handleApplicationEvent(topic, data);
            }
        });

        // Subscribe to debugger connection events to show/hide tabs
        this.application.sub(/^debugger:connected$/, (topic, data) => {
            this.logger.info('Debugger connected - showing tabs');
            this.showTabs();
        });

        this.application.sub(/^debugger:disconnected$/, (topic, data) => {
            this.logger.info('Debugger disconnected - hiding tabs');
            this.hideTabs();
        });

        // Bind toolbar handlers
        this.view.bindToolbarHandlers({
            onFilterChange: () => this.updateDisplay(),
            onSearchChange: (searchText) => this.updateDisplay(),
            onClear: () => this.clearConsole(),
            onToggleCollapse: () => this.toggleCollapse(),
            onDetach: () => this.detachConsole()
        });

        // Bind tab click handlers for docked tabs
        $('#console-tabs .console-tab').on('click', (e) => {
            this.handleTabClick(e);
        });

        // Restore collapsed state from localStorage
        const isCollapsed = localStorage.getItem('console-collapsed') === 'true';
        if (isCollapsed) {
            this.toggleCollapse();
        }

        this.logger.info('Console UI controller bound');
    }

    /**
     * Handle debugger console messages
     * @param {string} topic - Event topic
     * @param {Object} data - Event data {type, args, stackTrace}
     */
    handleDebuggerConsole(topic, data) {
        this.logger.debug('Debugger console:', data);

        // Transform args array to message string
        const message = this.formatDebuggerMessage(data.args);

        // Map console type to log level
        const levelMap = {
            'log': 'INFO',
            'warn': 'WARN',
            'error': 'ERROR',
            'debug': 'DEBUG',
            'info': 'INFO'
        };

        const level = levelMap[data.type] || 'INFO';

        this.model.addMessage(level, 'debugger', data.type, message, data);
        this.updateDisplay();
    }

    /**
     * Format debugger console args into a readable message
     * @param {Array} args - Console arguments
     * @returns {string} Formatted message
     */
    formatDebuggerMessage(args) {
        if (!args || args.length === 0) {
            return '';
        }

        return args.map(arg => {
            if (typeof arg === 'undefined') return 'undefined';
            if (arg === null) return 'null';
            if (typeof arg === 'object' && arg.value !== undefined) {
                return String(arg.value);
            }
            if (typeof arg === 'object' && arg.type === 'object') {
                return '[Object]';
            }
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Object]';
                }
            }
            return String(arg);
        }).join(' ');
    }

    /**
     * Handle application pub/sub events
     * @param {string} topic - Event topic
     * @param {Object} data - Event data
     */
    handleApplicationEvent(topic, data) {
        this.logger.debug('Application event:', topic, data);

        // Format event message
        const message = this.formatEventMessage(topic, data);

        this.model.addMessage('EVENT', 'application', topic, message, data);
        this.updateDisplay();
    }

    /**
     * Format application event into readable message
     * @param {string} topic - Event topic
     * @param {Object} data - Event data
     * @returns {string} Formatted message
     */
    formatEventMessage(topic, data) {
        // Create a human-readable summary
        let parts = [topic];

        if (data) {
            // Extract key information based on event type
            if (data.filename) parts.push(`file: ${data.filename}`);
            if (data.url) parts.push(`url: ${data.url}`);
            if (data.reason) parts.push(`reason: ${data.reason}`);
            if (data.line !== undefined) parts.push(`line: ${data.line}`);
            if (data.mode) parts.push(`mode: ${data.mode}`);
        }

        return parts.join(' | ');
    }

    /**
     * Determine if an event should be logged
     * @param {string} topic - Event topic
     * @returns {boolean}
     */
    shouldLogEvent(topic) {
        // Don't log debugger:console twice
        if (topic === 'debugger:console') {
            return false;
        }

        // Check against noisy event patterns
        for (const pattern of this.noisyEvents) {
            if (pattern.test(topic)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Schedule a batched console display update
     * Uses requestAnimationFrame to batch multiple rapid updates into one render
     */
    updateDisplay() {
        // If an update is already scheduled, don't schedule another
        if (this.updateScheduled) {
            return;
        }

        this.updateScheduled = true;

        // Use requestAnimationFrame to batch updates
        requestAnimationFrame(() => {
            this.updateScheduled = false;
            this.performUpdate();
        });
    }

    /**
     * Perform the actual console display update
     * Called by requestAnimationFrame from updateDisplay()
     */
    performUpdate() {
        if (!this.view) return;

        const activeLevels = this.view.getActiveLevels();
        const searchText = this.view.getSearchText();

        const messages = this.model.getMessages({
            levels: activeLevels.length > 0 ? activeLevels : null,
            searchText: searchText
        });

        this.view.renderMessages(messages);
    }

    /**
     * Clear console messages
     */
    clearConsole() {
        this.model.clear();
        this.view.clear();
        this.logger.info('Console cleared');
    }

    /**
     * Toggle console collapse/expand
     */
    toggleCollapse() {
        const panel = $('#console-panel');
        const wasCollapsed = panel.hasClass('console-collapsed');

        panel.toggleClass('console-collapsed');

        // Update collapse button icon
        const collapseBtn = $('#console-collapse-btn');
        collapseBtn.html(wasCollapsed ? '▼' : '▲');

        // Resize Ace editor after transition
        setTimeout(() => {
            this.resizeAceEditor();

            // Update split sizes if split exists - use saved sizes or defaults
            if (this.consoleSplit) {
                if (wasCollapsed) {
                    // Restore saved sizes or use defaults
                    const savedSizes = localStorage.getItem('console-split-sizes');
                    if (savedSizes) {
                        try {
                            this.consoleSplit.setSizes(JSON.parse(savedSizes));
                        } catch (e) {
                            this.consoleSplit.setSizes([70, 30]);
                        }
                    } else {
                        this.consoleSplit.setSizes([70, 30]);
                    }
                } else {
                    // Collapsing - set to minimal size
                    this.consoleSplit.setSizes([100, 0]);
                }
            }
        }, 350);

        // Persist state
        localStorage.setItem('console-collapsed', !wasCollapsed);

        this.logger.info('Console collapsed:', !wasCollapsed);
    }

    /**
     * Detach console into floating window with tabs
     */
    detachConsole() {
        if (this.isDetached) {
            this.reattachConsole();
            return;
        }

        this.logger.info('Detaching console');

        // Get console content
        const consoleContent = $('#console-content').detach();
        const consoleToolbar = $('#console-toolbar').detach();

        // Create floating window
        this.detachedWindow = $('<div></div>')
            .addClass('draggable-window console-window')
            .css({
                width: '800px',
                height: '400px',
                top: '100px',
                left: '200px'
            });

        // Add header with close button
        const header = $('<div></div>')
            .addClass('draggable-header')
            .html('Debug Console <span class="close-btn" id="console-reattach-btn">×</span>');

        // Create tabs container
        const tabsContainer = $('<div></div>')
            .addClass('console-tabs');

        // Create tab buttons
        const consoleTab = $('<div></div>')
            .addClass('console-tab active')
            .attr('data-tab', 'console')
            .text('Console');

        const breakpointsTab = $('<div></div>')
            .addClass('console-tab')
            .attr('data-tab', 'breakpoints')
            .text('Breakpoints');

        const watchesTab = $('<div></div>')
            .addClass('console-tab')
            .attr('data-tab', 'watches')
            .text('Watches');

        const scopesTab = $('<div></div>')
            .addClass('console-tab')
            .attr('data-tab', 'scopes')
            .text('Scopes');

        tabsContainer.append(consoleTab, breakpointsTab, watchesTab, scopesTab);

        // Create tab content containers
        const consoleTabContent = $('<div></div>')
            .addClass('console-tab-content active')
            .attr('data-tab-content', 'console')
            .append(consoleToolbar)
            .append(consoleContent);

        const breakpointsTabContent = $('<div></div>')
            .addClass('console-tab-content')
            .attr('data-tab-content', 'breakpoints')
            .html('<div class="tab-placeholder">Breakpoints panel content will appear here</div>');

        const watchesTabContent = $('<div></div>')
            .addClass('console-tab-content')
            .attr('data-tab-content', 'watches')
            .html('<div class="tab-placeholder">Watches coming soon...</div>');

        const scopesTabContent = $('<div></div>')
            .addClass('console-tab-content')
            .attr('data-tab-content', 'scopes')
            .html('<div class="tab-placeholder">Scopes coming soon...</div>');

        // Add content area
        const content = $('<div></div>')
            .addClass('draggable-content console-detached-content')
            .append(tabsContainer)
            .append(consoleTabContent)
            .append(breakpointsTabContent)
            .append(watchesTabContent)
            .append(scopesTabContent);

        this.detachedWindow.append(header).append(content);

        // Bind tab click handlers
        this.detachedWindow.find('.console-tab').on('click', (e) => {
            const clickedTab = $(e.currentTarget);
            const tabName = clickedTab.attr('data-tab');

            // Update active tab
            this.detachedWindow.find('.console-tab').removeClass('active');
            clickedTab.addClass('active');

            // Update active content
            this.detachedWindow.find('.console-tab-content').removeClass('active');
            this.detachedWindow.find(`[data-tab-content="${tabName}"]`).addClass('active');

            this.logger.info('Switched to tab:', tabName);
        });

        // Make draggable and resizable
        this.detachedWindow.draggable({ handle: '.draggable-header' });
        this.detachedWindow.resizable({
            minWidth: 400,
            minHeight: 200
        });

        // Append to body
        $('body').append(this.detachedWindow);

        // Show placeholder in original location
        $('#console-panel').append(
            '<div class="console-placeholder">' +
            'Console detached. <a href="#" id="console-reattach-link">Reattach</a>' +
            '</div>'
        );

        // Bind reattach handlers
        $('#console-reattach-btn, #console-reattach-link').on('click', (e) => {
            e.preventDefault();
            this.reattachConsole();
        });

        this.isDetached = true;

        // Adjust split sizes to give console space
        if (this.consoleSplit) {
            this.consoleSplit.setSizes([100, 0]);
        }

        // Resize editor
        this.resizeAceEditor();

        this.logger.info('Console detached with tabs');
    }

    /**
     * Reattach console from floating window
     */
    reattachConsole() {
        if (!this.isDetached) return;

        this.logger.info('Reattaching console');

        // Get content from floating window
        const consoleContent = this.detachedWindow.find('#console-content').detach();
        const consoleToolbar = this.detachedWindow.find('#console-toolbar').detach();

        // Remove placeholder
        $('.console-placeholder').remove();

        // Reattach to panel - put back into the console tab content
        $('#console-tab-content').append(consoleToolbar).append(consoleContent);

        // Reset inline styles that may have been added while detached
        consoleContent.css('height', '');

        // Remove floating window
        this.detachedWindow.remove();
        this.detachedWindow = null;

        this.isDetached = false;

        // Restore split sizes
        if (this.consoleSplit) {
            const savedSizes = localStorage.getItem('console-split-sizes');
            if (savedSizes) {
                try {
                    this.consoleSplit.setSizes(JSON.parse(savedSizes));
                } catch (e) {
                    this.consoleSplit.setSizes([70, 30]);
                }
            } else {
                this.consoleSplit.setSizes([70, 30]);
            }
        }

        // Resize editor after a short delay to ensure layout is settled
        setTimeout(() => {
            this.resizeAceEditor();
        }, 100);

        this.logger.info('Console reattached');
    }

    /**
     * Resize Ace editor (call after layout changes)
     */
    resizeAceEditor() {
        const codeFrame = document.getElementById('code');
        if (codeFrame && codeFrame.contentWindow && codeFrame.contentWindow.editor) {
            codeFrame.contentWindow.editor.resize();
            this.logger.debug('Ace editor resized');
        }
    }

    /**
     * Set the console split instance
     * @param {Object} split - Split.js instance
     */
    setConsoleSplit(split) {
        this.consoleSplit = split;
        this.logger.info('Console split instance set');
    }

    /**
     * Show tabs when proxy is ready
     */
    showTabs() {
        $('#console-tabs').fadeIn(200);
        this.logger.info('Tabs shown');
    }

    /**
     * Hide tabs when proxy closes
     */
    hideTabs() {
        $('#console-tabs').fadeOut(200);
        // Reset to console tab
        this.switchToTab('console');
        this.logger.info('Tabs hidden');
    }

    /**
     * Handle tab click in docked view
     */
    handleTabClick(e) {
        const clickedTab = $(e.currentTarget);
        const tabName = clickedTab.attr('data-tab');
        this.switchToTab(tabName);
    }

    /**
     * Switch to a specific tab
     */
    switchToTab(tabName) {
        // Update active tab in docked view
        $('#console-tabs .console-tab').removeClass('active');
        $(`#console-tabs .console-tab[data-tab="${tabName}"]`).addClass('active');

        // Update active content in docked view
        $('#console-panel .console-tab-content').removeClass('active');
        $(`#console-panel [data-tab-content="${tabName}"]`).addClass('active');

        this.logger.info('Switched to tab:', tabName);
    }
}