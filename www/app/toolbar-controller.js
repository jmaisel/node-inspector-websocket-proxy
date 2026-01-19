/**
 * ToolbarController - Manages unified application toolbar interactions
 *
 * Handles dropdown menus (mode, theme), fullscreen toggle, and coordinates
 * dropdown visibility across the application.
 *
 * @class ToolbarController
 */
class ToolbarController {
    /**
     * Creates a new ToolbarController
     */
    constructor() {
        this.logger = new Logger('ToolbarController');
        this.application = null;
    }

    /**
     * Set the application context
     * @param {Object} ctx - The application context
     */
    setCtx(ctx) {
        this.logger.info('setCtx', ctx);
        this.application = ctx;
    }

    /**
     * Initialize the toolbar controller
     */
    initialize() {
        this.logger.info('Initializing ToolbarController');
        this.bind();
    }

    /**
     * Bind all toolbar event handlers
     */
    bind() {
        this.logger.info('Binding toolbar event handlers');

        this.bindModeDropdown();
        this.bindThemeDropdown();
        this.bindFullscreen();
        this.bindGlobalDropdownClose();
    }

    /**
     * Bind mode dropdown handlers
     */
    bindModeDropdown() {
        this.logger.info('Binding mode dropdown');

        // Mode dropdown toggle
        $(document).on('click', '#mode-menu-btn', (e) => {
            e.stopPropagation();
            const dropdown = $('#mode-dropdown-content');

            // Toggle dropdown
            const isVisible = dropdown.hasClass('show');
            $('.toolbar-dropdown-content').removeClass('show');

            if (!isVisible) {
                dropdown.addClass('show');

                // Position dropdown below button
                const rect = e.currentTarget.getBoundingClientRect();
                dropdown.css({
                    top: (rect.bottom + 2) + 'px',
                    left: rect.left + 'px'
                });
            }
        });

        // Mode menu item handlers - delegate to existing ModeController
        $(document).on('click', '#mode-design-btn', (e) => {
            e.stopPropagation();
            if (this.application && this.application.dbtsMenuController) {
                this.application.dbtsMenuController.designMode();
                $('#mode-dropdown-content').removeClass('show');
            } else {
                this.logger.warn('ModeController not available');
            }
        });

        $(document).on('click', '#mode-build-btn', (e) => {
            e.stopPropagation();
            if (this.application && this.application.dbtsMenuController) {
                this.application.dbtsMenuController.buildMode();
                $('#mode-dropdown-content').removeClass('show');
            } else {
                this.logger.warn('ModeController not available');
            }
        });
    }

    /**
     * Bind theme dropdown handlers
     */
    bindThemeDropdown() {
        this.logger.info('Binding theme dropdown');

        // Theme dropdown toggle
        $(document).on('click', '#theme-menu-btn', (e) => {
            e.stopPropagation();
            const dropdown = $('#theme-dropdown-content');

            // Populate dropdown if empty
            if (dropdown.children().length === 0 && window.themeSwitcher && window.themeSwitcher.themes) {
                this.populateThemeDropdown(dropdown);
            }

            // Toggle dropdown
            const isVisible = dropdown.hasClass('show');
            $('.toolbar-dropdown-content').removeClass('show');

            if (!isVisible) {
                dropdown.addClass('show');

                // Position dropdown below button
                const rect = e.currentTarget.getBoundingClientRect();
                dropdown.css({
                    top: (rect.bottom + 2) + 'px',
                    left: rect.left + 'px'
                });
            }
        });
    }

    /**
     * Populate theme dropdown with available themes
     * @param {jQuery} dropdown - The dropdown element to populate
     */
    populateThemeDropdown(dropdown) {
        this.logger.info('Populating theme dropdown');

        if (!window.themeSwitcher || !window.themeSwitcher.themes) {
            this.logger.warn('ThemeSwitcher not available');
            return;
        }

        window.themeSwitcher.themes.forEach(theme => {
            const option = $('<div>')
                .addClass('menu-item')
                .attr('data-theme', theme.id)
                .html(`${theme.icon} ${theme.name}`)
                .attr('title', `Switch to ${theme.name} theme`);

            if (theme.id === window.themeSwitcher.currentTheme) {
                option.css('font-weight', 'bold');
            }

            option.on('click', (e) => {
                e.stopPropagation();
                window.themeSwitcher.applyTheme(theme.id);
                dropdown.removeClass('show');

                // Update active indicator
                dropdown.find('.menu-item').css('font-weight', 'normal');
                $(e.currentTarget).css('font-weight', 'bold');
            });

            dropdown.append(option);
        });
    }

    /**
     * Bind fullscreen toggle handlers
     */
    bindFullscreen() {
        this.logger.info('Binding fullscreen handlers');

        // Fullscreen button click handler
        $(document).on('click', '#fullscreen-btn', () => {
            this.toggleFullscreen();
        });

        // Update icon when fullscreen state changes
        $(document).on('fullscreenchange webkitfullscreenchange mozfullscreenchange MSFullscreenChange', () => {
            this.updateFullscreenIcon();
        });
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        this.logger.info('Toggling fullscreen');

        const elem = document.documentElement;
        const isFullscreen = document.fullscreenElement ||
                           document.webkitFullscreenElement ||
                           document.mozFullScreenElement;

        if (!isFullscreen) {
            // Enter fullscreen
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    /**
     * Update fullscreen icon based on current state
     */
    updateFullscreenIcon() {
        const icon = $('#fullscreen-icon');
        const isFullscreen = document.fullscreenElement ||
                           document.webkitFullscreenElement ||
                           document.mozFullScreenElement;

        // Using same icon for both states (⛶)
        // Could differentiate if desired
        icon.text('⛶');
    }

    /**
     * Bind global dropdown close handler
     */
    bindGlobalDropdownClose() {
        this.logger.info('Binding global dropdown close handler');

        // Close dropdowns when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.toolbar-dropdown').length) {
                $('.toolbar-dropdown-content').removeClass('show');
            }
        });
    }
}
