import { DockableView } from '../core/DockableView.js';
import { toolbarTemplate } from '../templates/toolbar-template.js';

/**
 * ToolbarView - Dockable toolbar with connection and debug controls
 *
 * Features:
 * - Connection controls (WebSocket URL, Connect button)
 * - Debug controls (Pause, Resume, Step Over/Into/Out, Disconnect)
 * - Settings panel for icon size
 * - Docking/undocking with dock zone
 */
export class ToolbarView extends DockableView {
    constructor(config = {}) {
        super({
            ...config,
            storagePrefix: config.storagePrefix || 'toolbar',
            draggableConfig: {
                handle: `#${config.instanceId || 'toolbar'}-grip`,
                containment: 'window',
                ...(config.draggableConfig || {})
            }
        });

        // Default state
        if (!this.state.wsUrl) {
            this.state.wsUrl = 'ws://localhost:8888';
        }
        if (!this.state.iconSize) {
            this.state.iconSize = 'medium';
        }
        if (this.state.showDebugControls === undefined) {
            this.state.showDebugControls = false;
        }
        if (this.state.showConnectionControls === undefined) {
            this.state.showConnectionControls = true;
        }
        if (this.state.showRedockBtn === undefined) {
            this.state.showRedockBtn = false;
        }
    }

    /**
     * Define element map
     */
    defineElementMap() {
        return {
            container: '',
            grip: '-grip',
            wsUrlInput: '-ws-url',
            connectBtn: '-connect-btn',
            disconnectBtn: '-disconnect-btn',
            pauseBtn: '-pause-btn',
            resumeBtn: '-resume-btn',
            stepOverBtn: '-step-over-btn',
            stepIntoBtn: '-step-into-btn',
            stepOutBtn: '-step-out-btn',
            settingsBtn: '-settings-btn',
            redockBtn: '-redock-btn',
            connectionControls: '-connection-controls',
            debugControls: '-debug-controls',
            settingsPanel: '-settings-panel',
            iconSizeSmall: '-icon-size-small',
            iconSizeMedium: '-icon-size-medium',
            iconSizeLarge: '-icon-size-large'
        };
    }

    /**
     * Get default template
     */
    getDefaultTemplate() {
        return toolbarTemplate;
    }

    /**
     * Attach event handlers
     */
    async attachEvents() {
        const elements = this.getElementMap();

        // Icon size buttons
        this.registerEventHandler(elements.iconSizeSmall, 'click', () => this.setIconSize('small'));
        this.registerEventHandler(elements.iconSizeMedium, 'click', () => this.setIconSize('medium'));
        this.registerEventHandler(elements.iconSizeLarge, 'click', () => this.setIconSize('large'));

        // Settings button toggle
        this.registerEventHandler(elements.settingsBtn, 'click', (e) => {
            e.stopPropagation();
            this.toggleSettingsPanel();
        });

        // Close settings panel when clicking outside
        $(document).on('click.toolbar-settings', (e) => {
            if (!$(e.target).closest(`#${this.instanceId}-settings-panel, #${this.instanceId}-settings-btn`).length) {
                this.hideSettingsPanel();
            }
        });

        // Redock button
        this.registerEventHandler(elements.redockBtn, 'click', () => {
            this.dock();
        });
    }

    /**
     * Set icon size
     * @param {string} size - 'small', 'medium', or 'large'
     */
    setIconSize(size) {
        this.setState({ iconSize: size });
        this.$element.attr('data-icon-size', size);
        this.hideSettingsPanel();

        // Save to localStorage
        localStorage.setItem(`${this.storagePrefix}-icon-size`, size);
    }

    /**
     * Toggle settings panel visibility
     */
    toggleSettingsPanel() {
        const elements = this.getElementMap();
        const $panel = $(elements.settingsPanel);

        if ($panel.is(':visible')) {
            this.hideSettingsPanel();
        } else {
            this.showSettingsPanel();
        }
    }

    /**
     * Show settings panel
     */
    showSettingsPanel() {
        const elements = this.getElementMap();
        const $panel = $(elements.settingsPanel);
        const $btn = $(elements.settingsBtn);

        // Position panel near settings button
        const btnOffset = $btn.offset();
        const btnHeight = $btn.outerHeight();

        $panel.css({
            top: btnOffset.top + btnHeight + 5,
            left: btnOffset.left
        });

        $panel.show();
    }

    /**
     * Hide settings panel
     */
    hideSettingsPanel() {
        const elements = this.getElementMap();
        $(elements.settingsPanel).hide();
    }

    /**
     * Show debug controls, hide connection controls
     */
    showDebugControls() {
        this.setState({
            showDebugControls: true,
            showConnectionControls: false
        });

        const elements = this.getElementMap();
        $(elements.debugControls).show();
        $(elements.connectionControls).hide();
    }

    /**
     * Show connection controls, hide debug controls
     */
    showConnectionControls() {
        this.setState({
            showDebugControls: false,
            showConnectionControls: true
        });

        const elements = this.getElementMap();
        $(elements.connectionControls).show();
        $(elements.debugControls).hide();
    }

    /**
     * Enable/disable debug control buttons
     * @param {Object} state - Button states { pause, resume, stepOver, stepInto, stepOut }
     */
    setDebugButtonStates(state) {
        const elements = this.getElementMap();

        if (state.pause !== undefined) {
            $(elements.pauseBtn).prop('disabled', !state.pause);
        }
        if (state.resume !== undefined) {
            $(elements.resumeBtn).prop('disabled', !state.resume);
        }
        if (state.stepOver !== undefined) {
            $(elements.stepOverBtn).prop('disabled', !state.stepOver);
        }
        if (state.stepInto !== undefined) {
            $(elements.stepIntoBtn).prop('disabled', !state.stepInto);
        }
        if (state.stepOut !== undefined) {
            $(elements.stepOutBtn).prop('disabled', !state.stepOut);
        }
    }

    /**
     * Get WebSocket URL from input
     * @returns {string} WebSocket URL
     */
    getWsUrl() {
        const elements = this.getElementMap();
        return $(elements.wsUrlInput).val();
    }

    /**
     * Set WebSocket URL in input
     * @param {string} url - WebSocket URL
     */
    setWsUrl(url) {
        this.setState({ wsUrl: url });
        const elements = this.getElementMap();
        $(elements.wsUrlInput).val(url);
    }

    /**
     * Dock toolbar to zone
     */
    dock() {
        if (!this.dockZone) {
            console.warn('No dock zone configured for toolbar');
            return;
        }

        const $zone = this.getDockZone();
        if ($zone.length === 0) {
            console.warn(`Dock zone not found: ${this.dockZone}`);
            return;
        }

        // Move toolbar to docking zone
        this.$element.addClass('docked-to-zone');
        this.applyPosition({
            position: '',
            top: '',
            left: '',
            right: '',
            bottom: '',
            width: ''
        });
        $zone.append(this.$element);
        $zone.addClass('has-toolbar');

        // Hide redock button
        this.setState({ showRedockBtn: false });
        const elements = this.getElementMap();
        $(elements.redockBtn).hide();

        // Save docked state
        this.saveDockState(true);
        this.clearPosition();

        // Re-enable draggable with undock behavior
        this.initDraggable({
            start: (event, ui) => this.handleDragStart(event, ui),
            drag: (event, ui) => this.handleDrag(event, ui),
            stop: (event, ui) => this.handleDragStop(event, ui)
        });
    }

    /**
     * Undock toolbar from zone
     */
    undock() {
        // Remove from zone
        this.$element.removeClass('docked-to-zone');

        const $zone = this.getDockZone();
        if ($zone.length > 0) {
            $zone.removeClass('has-toolbar');
        }

        $('body').append(this.$element);

        // Make floating
        this.applyPosition({
            position: 'absolute',
            top: 40,
            left: 0,
            right: 'auto',
            bottom: 'auto',
            width: 'auto'
        });

        // Show redock button
        this.setState({ showRedockBtn: true });
        const elements = this.getElementMap();
        $(elements.redockBtn).show();

        // Save undocked state
        this.saveDockState(false);

        // Re-enable draggable with zone-snapping
        this.initDraggable({
            drag: (event, ui) => this.handleDrag(event, ui),
            stop: (event, ui) => this.handleDragStop(event, ui)
        });
    }

    /**
     * Handle drag start
     */
    handleDragStart(event, ui) {
        // Undock immediately
        this.$element.removeClass('docked-to-zone');

        const $zone = this.getDockZone();
        if ($zone.length > 0) {
            $zone.removeClass('has-toolbar');
        }

        // Calculate current offset position
        const offset = this.$element.offset();

        // Move to body
        $('body').append(this.$element);

        // Set absolute position
        this.applyPosition({
            position: 'absolute',
            top: offset.top,
            left: offset.left,
            right: 'auto',
            bottom: 'auto',
            width: 'auto'
        });

        // Show redock button
        this.setState({ showRedockBtn: true });
        const elements = this.getElementMap();
        $(elements.redockBtn).show();

        // Save undocked state
        this.saveDockState(false);
    }

    /**
     * Handle drag
     */
    handleDrag(event, ui) {
        const $zone = this.getDockZone();
        if ($zone.length === 0) return;

        // Check if near docking zone
        const zoneOffset = $zone.offset();
        const zoneHeight = 50;

        if (ui.offset.top < zoneOffset.top + zoneHeight &&
            ui.offset.top > zoneOffset.top - zoneHeight) {
            this.highlightDockZone();
        } else {
            this.unhighlightDockZone();
        }
    }

    /**
     * Handle drag stop
     */
    handleDragStop(event, ui) {
        this.unhighlightDockZone();

        const $zone = this.getDockZone();
        if ($zone.length === 0) {
            this.savePosition(ui.position);
            return;
        }

        // Check if near docking zone
        const zoneOffset = $zone.offset();
        const zoneHeight = 50;

        if (ui.offset.top < zoneOffset.top + zoneHeight &&
            ui.offset.top > zoneOffset.top - zoneHeight) {
            // Snap to docking zone
            this.dock();
        } else {
            // Save floating position
            this.savePosition(ui.position);
        }
    }

    /**
     * Initialize after mount
     */
    async onMounted() {
        // Restore icon size
        const savedSize = localStorage.getItem(`${this.storagePrefix}-icon-size`);
        if (savedSize) {
            this.setIconSize(savedSize);
        }

        // Check if should be docked
        const isDocked = this.restoreDockState(true);

        if (isDocked && this.dockZone) {
            // Dock to zone
            this.dock();
        } else {
            // Show redock button for floating toolbar
            this.setState({ showRedockBtn: true });
            const elements = this.getElementMap();
            $(elements.redockBtn).show();

            // Restore floating position or use default
            const savedPos = this.restorePosition();
            if (savedPos) {
                this.applyPosition({
                    position: 'absolute',
                    top: savedPos.top,
                    left: savedPos.left,
                    right: 'auto',
                    bottom: 'auto',
                    width: 'auto'
                });
            }

            // Make toolbar draggable
            this.initDraggable({
                drag: (event, ui) => this.handleDrag(event, ui),
                stop: (event, ui) => this.handleDragStop(event, ui)
            });
        }
    }

    /**
     * Clean up on unmount
     */
    onUnmounted() {
        // Remove document click handler
        $(document).off('click.toolbar-settings');
    }
}
