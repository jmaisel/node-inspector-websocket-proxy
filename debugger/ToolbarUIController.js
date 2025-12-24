/**
 * ToolbarUIController - Manages the dockable toolbar and settings panel
 */
class ToolbarUIController extends BaseUIController {
    constructor() {
        super();
        this.$toolbar = $('#toolbar');
        this.$zone = $('#toolbarDockZone');
        this.$settingsPanel = $('#settingsPanel');
    }

    /**
     * Set the icon size for toolbar buttons
     * @param {string} size - 'small', 'medium', or 'large'
     */
    setIconSize(size) {
        this.$toolbar.attr('data-icon-size', size);
        localStorage.setItem('debugger-icon-size', size);
        this.$settingsPanel.hide();
    }

    /**
     * Dock the toolbar to its designated zone
     */
    dockToolbarToZone() {
        // Disable draggable
        if (this.$toolbar.data('ui-draggable')) {
            this.$toolbar.draggable('destroy');
        }

        // Move toolbar to docking zone
        this.$toolbar.addClass('docked-to-zone');
        this.$toolbar.css({ top: '', left: '', position: '' });
        this.$zone.append(this.$toolbar);
        this.$zone.addClass('has-toolbar');

        // Hide redock button when docked
        $('#toolbarRedockBtn').hide();

        // Save docked state
        localStorage.setItem('debugger-toolbar-docked', 'true');
        localStorage.removeItem('debugger-toolbar-pos');

        // Re-enable draggable with updated behavior
        this.$toolbar.draggable({
            handle: '#toolbarGrip',
            start: () => {
                // Undock on drag start
                this.undockToolbarFromZone();
            }
        });
    }

    /**
     * Undock the toolbar from its zone (make it floating)
     */
    undockToolbarFromZone() {
        // Remove from zone
        this.$toolbar.removeClass('docked-to-zone');
        this.$zone.removeClass('has-toolbar');
        $('body').append(this.$toolbar);

        // Make floating
        this.$toolbar.css({
            position: 'absolute',
            top: 40,
            left: 0
        });

        // Show redock button when floating
        $('#toolbarRedockBtn').show();

        // Save undocked state
        localStorage.setItem('debugger-toolbar-docked', 'false');

        // Re-enable draggable
        if (this.$toolbar.data('ui-draggable')) {
            this.$toolbar.draggable('destroy');
        }

        this.$toolbar.draggable({
            handle: '#toolbarGrip',
            containment: 'window',
            stop: (event, ui) => {
                // Check if near docking zone
                const zoneOffset = this.$zone.offset();
                const zoneHeight = 50; // Detection zone

                if (ui.offset.top < zoneOffset.top + zoneHeight &&
                    ui.offset.top > zoneOffset.top - zoneHeight) {
                    // Snap to docking zone
                    this.dockToolbarToZone();
                } else {
                    // Save floating position
                    localStorage.setItem('debugger-toolbar-pos', JSON.stringify({
                        top: ui.position.top,
                        left: ui.position.left
                    }));
                }
            }
        });
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
        const isDocked = localStorage.getItem('debugger-toolbar-docked');

        if (isDocked === 'true') {
            // Dock to zone
            this.dockToolbarToZone();
        } else {
            // Show redock button for floating toolbar
            $('#toolbarRedockBtn').show();

            // Restore floating position or use default
            const savedPos = localStorage.getItem('debugger-toolbar-pos');
            if (savedPos) {
                const pos = JSON.parse(savedPos);
                this.$toolbar.css({ top: pos.top, left: pos.left });
            }

            // Make toolbar draggable
            this.$toolbar.draggable({
                handle: '#toolbarGrip',
                containment: 'window',
                stop: (event, ui) => {
                    // Check if near docking zone
                    const zoneOffset = this.$zone.offset();
                    const zoneHeight = 50;

                    if (ui.offset.top < zoneOffset.top + zoneHeight &&
                        ui.offset.top > zoneOffset.top - zoneHeight) {
                        // Snap to docking zone
                        this.dockToolbarToZone();
                    } else {
                        // Save floating position
                        localStorage.setItem('debugger-toolbar-pos', JSON.stringify({
                            top: ui.position.top,
                            left: ui.position.left
                        }));
                    }
                }
            });
        }
    }
}