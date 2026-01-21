/**
 * PreferencesController
 *
 * Manages user preferences for editor, console, and appearance
 */
class PreferencesController {
    constructor() {
        this.logger = new Logger('PreferencesController');
        this.defaults = {
            // Appearance
            theme: 'dark',

            // Editor Font
            fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
            fontSize: 14,
            lineHeight: 1.5,

            // Editor Theme
            aceTheme: 'one_dark',
            editorBg: '#1e1e1e',

            // Editor Behavior
            tabSize: 4,

            // Format Settings
            formatIndentSize: 4,
            formatBraceStyle: 'collapse',
            formatPreserveNewlines: true,
            formatSpaceBeforeConditional: true,
            formatKeepArrayIndentation: false,

            // Console
            consoleFontSize: 12
        };

        this.preferences = this.loadPreferences();
        this.isOpen = false;
    }

    /**
     * Initialize the preferences system
     */
    init() {
        this.logger.info('Initializing preferences controller');

        // Load and inject the preferences HTML
        this.loadPreferencesHTML();

        // Apply saved preferences
        this.applyPreferences();

        this.logger.info('Preferences initialized');
    }

    /**
     * Load preferences HTML into the page
     */
    async loadPreferencesHTML() {
        try {
            const response = await fetch('/preferences/preferences.html');
            const html = await response.text();

            // Inject into body
            const container = document.createElement('div');
            container.innerHTML = html;
            document.body.appendChild(container.firstElementChild);

            // Initialize UI
            this.initUI();
        } catch (e) {
            this.logger.error('Failed to load preferences HTML:', e);
        }
    }

    /**
     * Initialize UI event handlers
     */
    initUI() {
        // Tab switching
        document.querySelectorAll('.preferences-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const panelId = tab.getAttribute('data-panel');
                this.switchPanel(panelId);
            });
        });

        // Close button
        document.getElementById('preferences-close-btn').addEventListener('click', () => {
            this.close();
        });

        // Close on overlay click
        document.getElementById('preferences-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'preferences-overlay') {
                this.close();
            }
        });

        // Apply button
        document.getElementById('preferences-apply-btn').addEventListener('click', () => {
            this.saveAndApply();
        });

        // Reset button
        document.getElementById('preferences-reset-btn').addEventListener('click', () => {
            this.resetToDefaults();
        });

        // Populate theme grid
        this.populateThemeGrid();

        // Load current values into form
        this.loadFormValues();

        // Live preview for editor settings
        this.initLivePreview();

        // Format preview button
        const formatPreviewBtn = document.getElementById('format-preview-update-btn');
        if (formatPreviewBtn) {
            formatPreviewBtn.addEventListener('click', () => {
                this.updateFormatPreview();
            });
        }

        // Auto-update format preview when settings change
        ['pref-format-indent-size', 'pref-format-brace-style'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.updateFormatPreview());
            }
        });

        ['pref-format-preserve-newlines', 'pref-format-space-before-conditional', 'pref-format-keep-array-indentation'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.updateFormatPreview());
            }
        });
    }

    /**
     * Switch to a different preference panel
     */
    switchPanel(panelId) {
        // Update tabs
        document.querySelectorAll('.preferences-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-panel="${panelId}"]`).classList.add('active');

        // Update panels
        document.querySelectorAll('.preferences-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`panel-${panelId}`).classList.add('active');
    }

    /**
     * Populate theme grid with available themes
     */
    populateThemeGrid() {
        const themes = [
            { id: 'dark', name: 'Dark', icon: '🌙' },
            { id: 'light', name: 'Light', icon: '☀️' },
            { id: 'cinnamon', name: 'Cinnamon', icon: '🌰' },
            { id: 'maple-waffles', name: 'Maple & Waffles', icon: '🧇' }
        ];

        const grid = document.getElementById('theme-grid');
        grid.innerHTML = '';

        themes.forEach(theme => {
            const card = document.createElement('div');
            card.className = 'theme-card';
            if (theme.id === this.preferences.theme) {
                card.classList.add('active');
            }
            card.dataset.theme = theme.id;
            card.innerHTML = `
                <div class="theme-card-icon">${theme.icon}</div>
                <div class="theme-card-name">${theme.name}</div>
            `;

            card.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.preferences.theme = theme.id;
            });

            grid.appendChild(card);
        });
    }

    /**
     * Load current preferences into form
     */
    loadFormValues() {
        document.getElementById('pref-font-family').value = this.preferences.fontFamily;
        document.getElementById('pref-font-size').value = this.preferences.fontSize;
        document.getElementById('pref-line-height').value = this.preferences.lineHeight;
        document.getElementById('pref-ace-theme').value = this.preferences.aceTheme;
        document.getElementById('pref-editor-bg').value = this.preferences.editorBg;
        document.getElementById('pref-tab-size').value = this.preferences.tabSize;
        document.getElementById('pref-console-font-size').value = this.preferences.consoleFontSize;

        // Format settings
        document.getElementById('pref-format-indent-size').value = this.preferences.formatIndentSize;
        document.getElementById('pref-format-brace-style').value = this.preferences.formatBraceStyle;
        document.getElementById('pref-format-preserve-newlines').checked = this.preferences.formatPreserveNewlines;
        document.getElementById('pref-format-space-before-conditional').checked = this.preferences.formatSpaceBeforeConditional;
        document.getElementById('pref-format-keep-array-indentation').checked = this.preferences.formatKeepArrayIndentation;

        // Update preview
        this.updateFormatPreview();
    }

    /**
     * Open the preferences dialog
     */
    open() {
        this.logger.info('Opening preferences dialog');
        const overlay = document.getElementById('preferences-overlay');
        if (overlay) {
            overlay.classList.add('show');
            this.isOpen = true;

            // Reload current values
            this.loadFormValues();
        }
    }

    /**
     * Close the preferences dialog
     */
    close() {
        this.logger.info('Closing preferences dialog');
        const overlay = document.getElementById('preferences-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            this.isOpen = false;
        }
    }

    /**
     * Save preferences from form and apply them
     */
    saveAndApply() {
        // Read values from form
        this.preferences.fontFamily = document.getElementById('pref-font-family').value;
        this.preferences.fontSize = parseInt(document.getElementById('pref-font-size').value);
        this.preferences.lineHeight = parseFloat(document.getElementById('pref-line-height').value);
        this.preferences.aceTheme = document.getElementById('pref-ace-theme').value;
        this.preferences.editorBg = document.getElementById('pref-editor-bg').value;
        this.preferences.tabSize = parseInt(document.getElementById('pref-tab-size').value);
        this.preferences.consoleFontSize = parseInt(document.getElementById('pref-console-font-size').value);

        // Format settings
        this.preferences.formatIndentSize = parseInt(document.getElementById('pref-format-indent-size').value);
        this.preferences.formatBraceStyle = document.getElementById('pref-format-brace-style').value;
        this.preferences.formatPreserveNewlines = document.getElementById('pref-format-preserve-newlines').checked;
        this.preferences.formatSpaceBeforeConditional = document.getElementById('pref-format-space-before-conditional').checked;
        this.preferences.formatKeepArrayIndentation = document.getElementById('pref-format-keep-array-indentation').checked;

        // Save to localStorage
        this.savePreferences();

        // Apply changes
        this.applyPreferences();

        // Close dialog
        this.close();

        this.logger.info('Preferences saved and applied');
    }

    /**
     * Reset all preferences to defaults
     */
    resetToDefaults() {
        if (confirm('Reset all preferences to defaults?')) {
            this.preferences = { ...this.defaults };
            this.loadFormValues();
            this.populateThemeGrid();
            this.logger.info('Preferences reset to defaults');
        }
    }

    /**
     * Load preferences from localStorage
     */
    loadPreferences() {
        try {
            const saved = localStorage.getItem('user-preferences');
            if (saved) {
                return { ...this.defaults, ...JSON.parse(saved) };
            }
        } catch (e) {
            this.logger.warn('Failed to load preferences:', e);
        }
        return { ...this.defaults };
    }

    /**
     * Save preferences to localStorage
     */
    savePreferences() {
        try {
            localStorage.setItem('user-preferences', JSON.stringify(this.preferences));
            this.logger.info('Preferences saved to localStorage');
        } catch (e) {
            this.logger.error('Failed to save preferences:', e);
        }
    }

    /**
     * Apply preferences to the application
     */
    applyPreferences() {
        this.logger.info('Applying preferences');

        // Apply theme
        this.applyTheme();

        // Apply Ace editor settings
        this.applyAceSettings();

        // Apply console settings
        this.applyConsoleSettings();
    }

    /**
     * Apply theme preference
     */
    applyTheme() {
        if (window.themeSwitcher) {
            window.themeSwitcher.applyTheme(this.preferences.theme);
        } else {
            // Fallback if theme switcher not available
            document.documentElement.setAttribute('data-theme', this.preferences.theme);
        }
    }

    /**
     * Apply Ace editor settings
     */
    applyAceSettings() {
        try {
            const codeFrame = document.getElementById('code');
            if (!codeFrame || !codeFrame.contentWindow || !codeFrame.contentWindow.editor) {
                this.logger.warn('Ace editor not available yet');
                return;
            }

            const editor = codeFrame.contentWindow.editor;
            const codeDoc = codeFrame.contentDocument || codeFrame.contentWindow.document;

            // Set font and appearance options
            editor.setOptions({
                fontFamily: this.preferences.fontFamily,
                fontSize: this.preferences.fontSize + 'px'
            });

            // Set line height via renderer
            editor.renderer.setOption('lineHeight', this.preferences.lineHeight);

            // Set tab size
            editor.session.setOption('tabSize', this.preferences.tabSize);

            // Set theme
            editor.setTheme(`ace/theme/${this.preferences.aceTheme}`);

            // Override background color
            const existingStyle = codeDoc.getElementById('pref-bg-override');
            if (existingStyle) {
                existingStyle.remove();
            }

            const style = codeDoc.createElement('style');
            style.id = 'pref-bg-override';
            style.textContent = `
                .ace_editor,
                .ace_gutter {
                    background-color: ${this.preferences.editorBg} !important;
                }
            `;
            codeDoc.head.appendChild(style);

            this.logger.info('Ace editor settings applied');
        } catch (e) {
            this.logger.error('Failed to apply Ace settings:', e);
        }
    }

    /**
     * Apply console settings
     */
    applyConsoleSettings() {
        try {
            const consoleContent = document.getElementById('console-content');
            if (consoleContent) {
                consoleContent.style.fontSize = this.preferences.consoleFontSize + 'px';
                this.logger.info('Console settings applied');
            }
        } catch (e) {
            this.logger.error('Failed to apply console settings:', e);
        }
    }

    /**
     * Initialize live preview for editor settings
     */
    initLivePreview() {
        this.logger.info('Initializing live preview');

        // Ace theme selector - live preview
        const aceThemeSelect = document.getElementById('pref-ace-theme');
        if (aceThemeSelect) {
            aceThemeSelect.addEventListener('change', () => {
                const theme = aceThemeSelect.value;
                this.logger.info('Live preview: Ace theme changed to', theme);
                this.applyAceThemeOnly(theme);
            });
        }

        // Font family - live preview
        const fontFamilySelect = document.getElementById('pref-font-family');
        if (fontFamilySelect) {
            fontFamilySelect.addEventListener('change', () => {
                const fontFamily = fontFamilySelect.value;
                this.logger.info('Live preview: Font family changed to', fontFamily);
                this.applyAceFontOnly(fontFamily, null);
            });
        }

        // Font size - live preview
        const fontSizeInput = document.getElementById('pref-font-size');
        if (fontSizeInput) {
            fontSizeInput.addEventListener('input', () => {
                const fontSize = parseInt(fontSizeInput.value);
                this.logger.info('Live preview: Font size changed to', fontSize);
                this.applyAceFontOnly(null, fontSize);
            });
        }

        // Line height - live preview
        const lineHeightInput = document.getElementById('pref-line-height');
        if (lineHeightInput) {
            lineHeightInput.addEventListener('input', () => {
                const lineHeight = parseFloat(lineHeightInput.value);
                this.logger.info('Live preview: Line height changed to', lineHeight);
                this.applyAceLineHeightOnly(lineHeight);
            });
        }

        // Background color - live preview
        const editorBgInput = document.getElementById('pref-editor-bg');
        if (editorBgInput) {
            editorBgInput.addEventListener('input', () => {
                const bgColor = editorBgInput.value;
                this.logger.info('Live preview: Background color changed to', bgColor);
                this.applyAceBgOnly(bgColor);
            });
        }

        this.logger.info('Live preview initialized');
    }

    /**
     * Apply only Ace theme for live preview
     */
    applyAceThemeOnly(theme) {
        try {
            const codeFrame = document.getElementById('code');
            if (!codeFrame || !codeFrame.contentWindow || !codeFrame.contentWindow.editor) {
                return;
            }

            const editor = codeFrame.contentWindow.editor;
            editor.setTheme(`ace/theme/${theme}`);
            this.logger.info(`Applied Ace theme: ${theme}`);
        } catch (e) {
            this.logger.error('Failed to apply Ace theme preview:', e);
        }
    }

    /**
     * Apply only font settings for live preview
     */
    applyAceFontOnly(fontFamily, fontSize) {
        try {
            const codeFrame = document.getElementById('code');
            if (!codeFrame || !codeFrame.contentWindow || !codeFrame.contentWindow.editor) {
                return;
            }

            const editor = codeFrame.contentWindow.editor;
            const options = {};

            if (fontFamily) {
                options.fontFamily = fontFamily;
            }
            if (fontSize) {
                options.fontSize = fontSize + 'px';
            }

            if (Object.keys(options).length > 0) {
                editor.setOptions(options);
            }
        } catch (e) {
            this.logger.error('Failed to apply font preview:', e);
        }
    }

    /**
     * Apply only line height for live preview
     */
    applyAceLineHeightOnly(lineHeight) {
        try {
            const codeFrame = document.getElementById('code');
            if (!codeFrame || !codeFrame.contentWindow || !codeFrame.contentWindow.editor) {
                return;
            }

            const editor = codeFrame.contentWindow.editor;
            editor.renderer.setOption('lineHeight', lineHeight);
        } catch (e) {
            this.logger.error('Failed to apply line height preview:', e);
        }
    }

    /**
     * Apply only background color for live preview
     */
    applyAceBgOnly(bgColor) {
        try {
            const codeFrame = document.getElementById('code');
            if (!codeFrame) {
                return;
            }

            const codeDoc = codeFrame.contentDocument || codeFrame.contentWindow.document;

            // Remove existing override
            const existingStyle = codeDoc.getElementById('pref-bg-override');
            if (existingStyle) {
                existingStyle.remove();
            }

            // Apply new background
            const style = codeDoc.createElement('style');
            style.id = 'pref-bg-override';
            style.textContent = `
                .ace_editor,
                .ace_gutter {
                    background-color: ${bgColor} !important;
                }
            `;
            codeDoc.head.appendChild(style);
        } catch (e) {
            this.logger.error('Failed to apply background color preview:', e);
        }
    }

    /**
     * Update format preview with current settings
     */
    updateFormatPreview() {
        this.logger.info('Updating format preview');

        try {
            // Get current format settings from form
            const indentSize = parseInt(document.getElementById('pref-format-indent-size').value) || 4;
            const braceStyle = document.getElementById('pref-format-brace-style').value || 'collapse';
            const preserveNewlines = document.getElementById('pref-format-preserve-newlines').checked;
            const spaceBeforeConditional = document.getElementById('pref-format-space-before-conditional').checked;
            const keepArrayIndentation = document.getElementById('pref-format-keep-array-indentation').checked;

            // Get source code
            const beforeCode = document.querySelector('#format-preview-before code');
            if (!beforeCode) {
                this.logger.warn('Preview elements not found');
                return;
            }

            const sourceCode = beforeCode.textContent;

            // Use js_beautify from Ace's beautify extension
            const codeFrame = document.getElementById('code');
            if (!codeFrame || !codeFrame.contentWindow) {
                this.logger.warn('Ace editor frame not available');
                return;
            }

            // Access js_beautify from the frame's window
            const beautify = codeFrame.contentWindow.js_beautify;
            if (!beautify) {
                this.logger.warn('js_beautify not available');
                // Fallback: just show the source with proper indentation
                const afterCode = document.querySelector('#format-preview-after code');
                if (afterCode) {
                    afterCode.textContent = sourceCode;
                }
                return;
            }

            // Apply formatting with current settings
            const formatted = beautify(sourceCode, {
                indent_size: indentSize,
                brace_style: braceStyle,
                preserve_newlines: preserveNewlines,
                space_before_conditional: spaceBeforeConditional,
                keep_array_indentation: keepArrayIndentation
            });

            // Update preview
            const afterCode = document.querySelector('#format-preview-after code');
            if (afterCode) {
                afterCode.textContent = formatted;
            }

            this.logger.info('Format preview updated');
        } catch (e) {
            this.logger.error('Failed to update format preview:', e);
        }
    }

    /**
     * Get current preferences
     */
    getPreferences() {
        return { ...this.preferences };
    }
}

// Create global instance
window.preferencesController = new PreferencesController();