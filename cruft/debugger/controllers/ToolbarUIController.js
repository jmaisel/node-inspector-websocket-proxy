import { DockableUIController } from './DockableUIController.js';

/**
 * ToolbarUIController - Manages the dockable toolbar and settings panel
 */
export class ToolbarUIController extends DockableUIController {
    constructor() {
        // Configure the dockable behavior
        super({
            $element: $('#toolbar'),
            storagePrefix: 'debugger-toolbar',
            draggableConfig: {
                handle: '#toolbarGrip',
                containment: 'window'
            }
        });

        this.$zone = $('#toolbarDockZone');
        this.$settingsPanel = $('#settingsPanel');
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
        $('#toolbarRedockBtn').hide();

        // Save docked state
        this.saveDockState(true);
        this.clearPosition();

        // Re-enable draggable with updated behavior (undock on drag start)
        this.initDraggable({
            start: (event, ui) => {
                // Undock immediately - move to body and set position before drag continues
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
                $('#toolbarRedockBtn').show();

                // Save undocked state
                this.saveDockState(false);
            },
            drag: (event, ui) => {
                // Check if near docking zone
                const zoneOffset = this.$zone.offset();
                const zoneHeight = 50;

                if (ui.offset.top < zoneOffset.top + zoneHeight &&
                    ui.offset.top > zoneOffset.top - zoneHeight) {
                    this.$zone.addClass('pulsate-dock-target');
                } else {
                    this.$zone.removeClass('pulsate-dock-target');
                }
            },
            stop: (event, ui) => {
                // Remove highlight
                this.$zone.removeClass('pulsate-dock-target');

                // Check if near docking zone
                const zoneOffset = this.$zone.offset();
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
        $('#toolbarRedockBtn').show();

        // Save undocked state
        this.saveDockState(false);

        // Re-enable draggable with zone-snapping behavior
        this.initDraggable({
            stop: (event, ui) => {
                // Check if near docking zone
                const zoneOffset = this.$zone.offset();
                const zoneHeight = 50; // Detection zone

                if (ui.offset.top < zoneOffset.top + zoneHeight &&
                    ui.offset.top > zoneOffset.top - zoneHeight) {
                    // Snap to docking zone
                    this.dock();
                } else {
                    // Save floating position
                    this.savePosition(ui.position);
                }
            }
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
        $('#iconSizeSmall').click(() => this.setIconSize('small'));
        $('#iconSizeMedium').click(() => this.setIconSize('medium'));
        $('#iconSizeLarge').click(() => this.setIconSize('large'));

        // Settings panel toggle
        $('#settingsBtn').click((e) => {
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
            if (!$(e.target).closest('#settingsPanel, #settingsBtn').length) {
                this.$settingsPanel.hide();
            }
        });

        // Redock button handler
        $('#toolbarRedockBtn').on('click', () => {
            this.dockToolbarToZone();
        });
    }

    /**
     * Initialize the toolbar - restore saved state and setup draggable
     */
    initialize() {
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
            $('#toolbarRedockBtn').show();

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
            this.initDraggable({
                stop: (event, ui) => {
                    // Check if near docking zone
                    const zoneOffset = this.$zone.offset();
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
            });
        }
    }
}