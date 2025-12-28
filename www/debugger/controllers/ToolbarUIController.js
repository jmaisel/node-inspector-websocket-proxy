import { DockableUIController } from './DockableUIController.js';
import { TemplateRegistry, generateInstanceId } from '../TemplateRegistry.js';
import { toolbarTemplate } from '../templates/toolbar-template.js';

/**
 * ToolbarUIController - Manages the dockable toolbar and settings panel
 *
 * Supports two modes:
 * 1. Standalone: Generates its own HTML from template
 * 2. Embedded: Uses existing HTML in the DOM
 *
 * @example
 * // Standalone with default template
 * const toolbar = new ToolbarUIController();
 * toolbar.mount('body', 'body');
 * toolbar.initialize();
 *
 * // Embedded with existing HTML
 * const toolbar = new ToolbarUIController({
 *     instanceId: 'toolbar',
 *     skipRender: true
 * });
 * toolbar.initialize();
 */
export class ToolbarUIController extends DockableUIController {
    constructor(config = {}) {
        const instanceId = config.instanceId || generateInstanceId('toolbar');

        // Configure the dockable behavior
        // Note: $element will be set after render() or in initialize() for embedded mode
        super({
            $element: config.skipRender ? $(`#${instanceId}`) : null,
            storagePrefix: config.storagePrefix || 'debugger-toolbar',
            draggableConfig: {
                handle: `#${instanceId}-grip`,
                containment: 'window'
            }
        });

        this.instanceId = instanceId;
        this.debuggerUI = config.debuggerUI || null;
        this.skipRender = config.skipRender || false;
        this.zoneSelector = config.zoneSelector || '#toolbarDockZone';

        // Store references (will be set after render/mount)
        this.$zone = null;
        this.$settingsPanel = null;
    }

    /**
     * Render HTML from template
     * @returns {Object} Object with toolbar and settingsPanel HTML strings
     */
    render() {
        const template = TemplateRegistry.get('toolbar') || toolbarTemplate;
        const savedSize = localStorage.getItem('debugger-icon-size') || 'medium';

        return template({
            wsUrl: 'ws://localhost:8888',
            iconSize: savedSize,
            debugControlsVisible: false
        }, this.instanceId);
    }

    /**
     * Mount the toolbar into DOM containers
     * @param {string|jQuery} toolbarContainer - Container for toolbar (e.g., 'body')
     * @param {string|jQuery} settingsContainer - Container for settings panel (e.g., 'body')
     */
    mount(toolbarContainer = 'body', settingsContainer = 'body') {
        if (this.skipRender) {
            // Use existing HTML
            this.$element = $(`#${this.instanceId}`);
            this.$zone = $(this.zoneSelector);
            this.$settingsPanel = $(`#${this.instanceId}-settings-panel`);
            return;
        }

        const html = this.render();

        // Inject toolbar
        $(toolbarContainer).append(html.toolbar);
        this.$element = $(`#${this.instanceId}`);

        // Inject settings panel
        $(settingsContainer).append(html.settingsPanel);
        this.$settingsPanel = $(`#${this.instanceId}-settings-panel`);

        // Get zone reference
        this.$zone = $(this.zoneSelector);
    }

    /**
     * Set the icon size for toolbar buttons
     * @param {string} size - 'small', 'medium', or 'large'
     */
    setIconSize(size) {
        this.$element.attr('data-icon-size', size);
        localStorage.setItem('debugger-icon-size', size);
        this.$settingsPanel.hide();
    }

    /**
     * Dock the toolbar to its designated zone (implements DockableUIController.dock)
     */
    dock() {
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
        this.$zone.append(this.$element);
        this.$zone.addClass('has-toolbar');

        // Hide redock button when docked
        $(`#${this.instanceId}-redock-btn`).hide();

        // Save docked state
        this.saveDockState(true);
        this.clearPosition();

        // When docked, set up draggable without containment constraint initially
        // The start handler will undock and update the element, then drag continues normally
        this.initDraggable({
            containment: false, // No containment while docked
            start: (event, ui) => {
                // Undock immediately - move to body and set position
                this.$element.removeClass('docked-to-zone');
                this.$zone.removeClass('has-toolbar');

                // Calculate current offset position
                const offset = this.$element.offset();

                // Move to body
                $('body').append(this.$element);

                // Set absolute position to match current location
                this.applyPosition({
                    position: 'absolute',
                    top: offset.top,
                    left: offset.left,
                    right: 'auto',
                    bottom: 'auto',
                    width: 'auto'
                });

                // Show redock button
                $(`#${this.instanceId}-redock-btn`).show();

                // Save undocked state
                this.saveDockState(false);

                // Update containment option for the current drag to 'window'
                this.$element.draggable('option', 'containment', 'window');
            },
            drag: (event, ui) => {
                // Check if near dock zone and highlight
                if (this.isNearTarget(ui.offset, this.$zone)) {
                    this.highlightTarget(this.$zone);
                } else {
                    this.unhighlightTarget(this.$zone);
                }
            },
            stop: (event, ui) => {
                // Remove highlight
                this.unhighlightTarget(this.$zone);

                // Check if near dock zone and snap
                if (this.isNearTarget(ui.offset, this.$zone)) {
                    this.dock();
                } else {
                    // Save floating position
                    this.savePosition(ui.position);
                }
            }
        });
    }

    /**
     * Undock the toolbar from its zone - make it floating (implements DockableUIController.undock)
     */
    undock() {
        // Remove from zone
        this.$element.removeClass('docked-to-zone');
        this.$zone.removeClass('has-toolbar');
        $('body').append(this.$element);

        // Make floating - ensure all position properties are set correctly
        // Clear width to prevent constraint from docked mode
        this.applyPosition({
            position: 'absolute',
            top: 40,
            left: 0,
            right: 'auto',
            bottom: 'auto',
            width: 'auto'
        });

        // Show redock button when floating
        $(`#${this.instanceId}-redock-btn`).show();

        // Save undocked state
        this.saveDockState(false);

        // Re-enable draggable with zone-snapping behavior
        this.setupDraggableWithZoneSnapping(this.$zone, () => {
            this.dock();
        });
    }

    /**
     * Dock the toolbar to its designated zone (public API for backwards compatibility)
     */
    dockToolbarToZone() {
        this.dock();
    }

    /**
     * Undock the toolbar from its zone (public API for backwards compatibility)
     */
    undockToolbarFromZone() {
        this.undock();
    }

    /**
     * Setup event handlers for toolbar controls
     */
    setupEventHandlers() {
        // Icon size button handlers
        $(`#${this.instanceId}-icon-size-small`).click(() => this.setIconSize('small'));
        $(`#${this.instanceId}-icon-size-medium`).click(() => this.setIconSize('medium'));
        $(`#${this.instanceId}-icon-size-large`).click(() => this.setIconSize('large'));

        // Settings panel toggle
        $(`#${this.instanceId}-settings-btn`).click((e) => {
            e.stopPropagation();
            const $panel = this.$settingsPanel;
            const $btn = $(e.currentTarget);

            if ($panel.is(':visible')) {
                $panel.hide();
            } else {
                // Position panel near the settings button
                const btnOffset = $btn.offset();
                const btnHeight = $btn.outerHeight();
                $panel.css({
                    top: btnOffset.top + btnHeight + 5,
                    left: btnOffset.left
                });
                $panel.show();
            }
        });

        // Close settings panel when clicking outside
        $(document).click((e) => {
            if (!$(e.target).closest(`#${this.instanceId}-settings-panel, #${this.instanceId}-settings-btn`).length) {
                this.$settingsPanel.hide();
            }
        });

        // Redock button handler
        $(`#${this.instanceId}-redock-btn`).on('click', () => {
            this.dockToolbarToZone();
        });
    }

    /**
     * Initialize the toolbar - restore saved state and setup draggable
     */
    initialize() {
        // If skipRender, ensure we have references to existing elements
        if (this.skipRender) {
            this.$element = $(`#${this.instanceId}`);
            this.$zone = $(this.zoneSelector);
            this.$settingsPanel = $(`#${this.instanceId}-settings-panel`);
        }

        // Setup event handlers
        this.setupEventHandlers();

        // Restore icon size
        const savedSize = localStorage.getItem('debugger-icon-size') || 'medium';
        this.setIconSize(savedSize);

        // Check if toolbar should be docked
        const isDocked = this.restoreDockState(true);

        if (isDocked) {
            // Dock to zone
            this.dock();
        } else {
            // Show redock button for floating toolbar
            $(`#${this.instanceId}-redock-btn`).show();

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

            // Make toolbar draggable with zone-snapping behavior
            this.setupDraggableWithZoneSnapping(this.$zone, () => {
                this.dock();
            });
        }
    }
}