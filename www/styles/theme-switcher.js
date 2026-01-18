/**
 * Theme Switcher
 *
 * Manages theme switching across the application
 * Saves user preference to localStorage
 */

class ThemeSwitcher {
    constructor() {
        this.themes = [
            { id: 'dark', name: 'Dark', icon: '🌙' },
            { id: 'light', name: 'Light', icon: '☀️' },
            { id: 'cinnamon', name: 'Cinnamon', icon: '🌰' },
            { id: 'maple-waffles', name: 'Maple & Waffles', icon: '🧇' }
        ];

        this.currentTheme = this.getSavedTheme() || 'dark';

        // Create logger if available, otherwise use console
        if (typeof Logger !== 'undefined') {
            this.logger = new Logger('ThemeSwitcher');
        } else {
            this.logger = {
                info: (...args) => console.log('[ThemeSwitcher]', ...args),
                warn: (...args) => console.warn('[ThemeSwitcher]', ...args),
                error: (...args) => console.error('[ThemeSwitcher]', ...args)
            };
        }
    }

    /**
     * Initialize theme switcher
     */
    init() {
        this.logger.info('Initializing theme switcher');
        console.log('🎨 Theme Switcher: Initializing...');

        // Apply saved theme
        this.applyTheme(this.currentTheme);

        // Create UI
        this.createUI();

        // Apply simulator background and Ace theme after a delay to ensure iframes are loaded
        setTimeout(() => {
            this.applySimulatorBackground();
            this.applyAceTheme();
        }, 1000);

        this.logger.info(`Theme initialized: ${this.currentTheme}`);
        console.log('🎨 Theme Switcher: UI created successfully');
    }

    /**
     * Get saved theme from localStorage
     */
    getSavedTheme() {
        try {
            return localStorage.getItem('app-theme');
        } catch (e) {
            this.logger.warn('Could not access localStorage', e);
            return null;
        }
    }

    /**
     * Save theme to localStorage
     */
    saveTheme(themeId) {
        try {
            localStorage.setItem('app-theme', themeId);
        } catch (e) {
            this.logger.warn('Could not save to localStorage', e);
        }
    }

    /**
     * Apply theme to document
     */
    applyTheme(themeId) {
        this.logger.info(`Applying theme: ${themeId}`);

        // Update data-theme attribute
        document.documentElement.setAttribute('data-theme', themeId);

        // Update current theme
        this.currentTheme = themeId;

        // Save to localStorage
        this.saveTheme(themeId);

        // Update UI to reflect current theme
        this.updateUI();

        // Apply simulator background color
        this.applySimulatorBackground();

        // Apply Ace editor theme
        this.applyAceTheme();

        // Publish theme change event
        if (window.application && application.pub) {
            application.pub('theme:changed', { theme: themeId });
        }
    }

    /**
     * Apply theme to Ace editor
     */
    applyAceTheme() {
        try {
            // Get the Ace theme and background color from CSS variables
            const aceTheme = getComputedStyle(document.documentElement)
                .getPropertyValue('--ace-theme')
                .trim();
            const bgColor = getComputedStyle(document.documentElement)
                .getPropertyValue('--simulator-bg')
                .trim();

            if (!aceTheme) {
                this.logger.warn('No --ace-theme CSS variable found');
                return;
            }

            this.logger.info(`Applying Ace theme: ${aceTheme} with background: ${bgColor}`);

            // Find Ace editor iframe
            const codeFrame = document.getElementById('code');
            if (!codeFrame) {
                this.logger.warn('Ace editor iframe not found');
                return;
            }

            // Wait for iframe to be ready
            const applyTheme = () => {
                try {
                    const codeWindow = codeFrame.contentWindow;
                    const codeDoc = codeFrame.contentDocument || codeWindow.document;

                    if (codeWindow && codeWindow.editor && codeWindow.editor.setTheme) {
                        // Apply the base Ace theme
                        codeWindow.editor.setTheme(`ace/theme/${aceTheme}`);

                        // Override the background color to match simulator
                        if (bgColor) {
                            // Remove existing override style if present
                            const existingStyle = codeDoc.getElementById('theme-bg-override');
                            if (existingStyle) {
                                existingStyle.remove();
                            }

                            // Inject CSS to override background
                            const style = codeDoc.createElement('style');
                            style.id = 'theme-bg-override';
                            style.textContent = `
                                .ace_editor,
                                .ace_gutter {
                                    background-color: ${bgColor} !important;
                                }
                            `;
                            codeDoc.head.appendChild(style);

                            this.logger.info(`✓ Ace theme set to: ${aceTheme} with background: ${bgColor}`);
                        } else {
                            this.logger.info(`✓ Ace theme set to: ${aceTheme}`);
                        }
                    } else {
                        this.logger.warn('Ace editor not available yet');
                    }
                } catch (e) {
                    this.logger.warn('Could not access Ace editor iframe', e);
                }
            };

            // Try immediately and also after a short delay
            applyTheme();
            setTimeout(applyTheme, 500);
        } catch (e) {
            this.logger.error('Error applying Ace theme', e);
        }
    }

    /**
     * Apply theme background color to CircuitJS1 simulator
     */
    applySimulatorBackground() {
        // Wait a bit for CSS to apply
        setTimeout(() => {
            try {
                // Get the simulator background color from CSS variable
                const bgColor = getComputedStyle(document.documentElement)
                    .getPropertyValue('--simulator-bg')
                    .trim();

                if (!bgColor) {
                    this.logger.warn('No --simulator-bg CSS variable found');
                    return;
                }

                this.logger.info(`Applying simulator background: ${bgColor}`);

                // Find simulator iframe - try both common IDs
                const simFrame = document.getElementById('simFrame') ||
                                 document.getElementById('circuitFrame');

                if (!simFrame) {
                    this.logger.warn('Simulator iframe not found (tried #simFrame and #circuitFrame)');
                    return;
                }

                this.logger.info(`Found simulator iframe: ${simFrame.id}`);

                // Wait for iframe to be ready
                const applyColor = () => {
                    try {
                        const simWindow = simFrame.contentWindow;
                        if (simWindow && simWindow.CircuitJS1 && simWindow.CircuitJS1.setBackgroundColor) {
                            simWindow.CircuitJS1.setBackgroundColor(bgColor);
                            this.logger.info(`✓ Simulator background set to: ${bgColor}`);
                        } else {
                            this.logger.warn('CircuitJS1.setBackgroundColor not available yet');
                        }
                    } catch (e) {
                        this.logger.warn('Could not access simulator iframe', e);
                    }
                };

                // Try immediately and also after a short delay
                applyColor();
                setTimeout(applyColor, 500);
            } catch (e) {
                this.logger.error('Error applying simulator background', e);
            }
        }, 100);
    }

    /**
     * Create theme switcher UI
     */
    createUI() {
        // Check if already exists
        if (document.getElementById('theme-switcher')) {
            console.log('🎨 Theme Switcher: Already exists, skipping creation');
            return;
        }

        console.log('🎨 Theme Switcher: Creating UI elements...');

        const container = document.createElement('div');
        container.id = 'theme-switcher';
        container.className = 'theme-switcher';

        const button = document.createElement('button');
        button.className = 'theme-switcher-button';
        button.innerHTML = '🎨';
        button.title = 'Change Theme';
        button.setAttribute('aria-label', 'Theme Switcher');

        const dropdown = document.createElement('div');
        dropdown.className = 'theme-switcher-dropdown';
        dropdown.style.display = 'none';

        // Create theme options
        this.themes.forEach(theme => {
            const option = document.createElement('button');
            option.className = 'theme-switcher-option';
            option.dataset.theme = theme.id;
            option.innerHTML = `${theme.icon} ${theme.name}`;
            option.title = `Switch to ${theme.name} theme`;

            if (theme.id === this.currentTheme) {
                option.classList.add('active');
            }

            option.addEventListener('click', () => {
                this.applyTheme(theme.id);
                dropdown.style.display = 'none';
            });

            dropdown.appendChild(option);
        });

        // Toggle dropdown on button click
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        container.appendChild(button);
        container.appendChild(dropdown);

        // Add to page (append to body, will be positioned by CSS)
        if (!document.body) {
            console.error('🎨 Theme Switcher: document.body not available!');
            return;
        }

        document.body.appendChild(container);

        console.log('🎨 Theme Switcher: Button added to DOM at', container);
        this.logger.info('Theme switcher UI created');
    }

    /**
     * Update UI to reflect current theme
     */
    updateUI() {
        const options = document.querySelectorAll('.theme-switcher-option');
        options.forEach(option => {
            if (option.dataset.theme === this.currentTheme) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }
}

// Create global instance
window.themeSwitcher = new ThemeSwitcher();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeSwitcher.init();
    });
} else {
    window.themeSwitcher.init();
}
