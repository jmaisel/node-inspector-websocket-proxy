/**
 * DockableUIController - Base class for UI controllers that support docking/undocking
 *
 * Provides common functionality for panels that can be docked (fixed position) or
 * floating (draggable). Handles position persistence, draggable/resizable setup,
 * and state management.
 *
 * Subclasses must implement:
 * - dock(): Dock the element to its designated position
 * - undock(): Undock the element (make it floating)
 */
class DockableUIController extends BaseUIController {
    /**
     * @param {Object} config - Configuration object
     * @param {jQuery} config.$element - The jQuery element to make dockable
     * @param {string} config.storagePrefix - Prefix for localStorage keys (e.g., 'console', 'toolbar')
     * @param {Object} config.draggableConfig - jQuery UI draggable configuration
     * @param {Object} config.resizableConfig - jQuery UI resizable configuration (optional)
     */
    constructor(config) {
        super();

        if (!config.$element || !config.storagePrefix) {
            throw new Error('DockableUIController requires $element and storagePrefix in config');
        }

        this.$element = config.$element;
        this.storagePrefix = config.storagePrefix;
        this.draggableConfig = config.draggableConfig || {};
        this.resizableConfig = config.resizableConfig || null;
        this.isDocked = true;
    }

    /**
     * Dock the element - must be implemented by subclass
     */
    dock() {
        throw new Error('dock() must be implemented by subclass');
    }

    /**
     * Undock the element - must be implemented by subclass
     */
    undock() {
        throw new Error('undock() must be implemented by subclass');
    }

    /**
     * Initialize draggable behavior with the given configuration
     * @param {Object} config - jQuery UI draggable configuration
     */
    initDraggable(config = {}) {
        const defaultConfig = {
            containment: 'window',
            ...this.draggableConfig,
            ...config
        };

        // Destroy existing draggable if it exists
        if (this.$element.data('ui-draggable')) {
            this.$element.draggable('destroy');
        }

        this.$element.draggable(defaultConfig);
    }

    /**
     * Enable or disable draggable functionality
     * @param {boolean} enabled - Whether to enable draggable
     */
    setDraggableEnabled(enabled) {
        if (this.$element.data('ui-draggable')) {
            this.$element.draggable(enabled ? 'enable' : 'disable');
        }
    }

    /**
     * Initialize resizable behavior with the given configuration
     * @param {Object} config - jQuery UI resizable configuration
     */
    initResizable(config = {}) {
        if (!this.resizableConfig) {
            return; // Resizable not configured
        }

        const defaultConfig = {
            ...this.resizableConfig,
            ...config
        };

        // Destroy existing resizable if it exists
        if (this.$element.data('ui-resizable')) {
            this.$element.resizable('destroy');
        }

        this.$element.resizable(defaultConfig);
    }

    /**
     * Enable or disable resizable functionality
     * @param {boolean} enabled - Whether to enable resizable
     */
    setResizableEnabled(enabled) {
        if (this.$element.data('ui-resizable')) {
            this.$element.resizable(enabled ? 'enable' : 'disable');
        }
    }

    /**
     * Update resizable options
     * @param {string} option - Option name
     * @param {*} value - Option value
     */
    setResizableOption(option, value) {
        if (this.$element.data('ui-resizable')) {
            this.$element.resizable('option', option, value);
        }
    }

    /**
     * Save the current position to localStorage
     * @param {Object} position - Position object with top and left
     */
    savePosition(position) {
        const key = `${this.storagePrefix}-dock-pos`;
        localStorage.setItem(key, JSON.stringify({
            top: position.top,
            left: position.left
        }));
    }

    /**
     * Restore position from localStorage
     * @returns {Object|null} Position object with top and left, or null if not saved
     */
    restorePosition() {
        const key = `${this.storagePrefix}-dock-pos`;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    }

    /**
     * Clear saved position from localStorage
     */
    clearPosition() {
        const key = `${this.storagePrefix}-dock-pos`;
        localStorage.removeItem(key);
    }

    /**
     * Save the dock state to localStorage
     * @param {boolean} isDocked - Whether the element is docked
     */
    saveDockState(isDocked) {
        const key = `${this.storagePrefix}-docked`;
        localStorage.setItem(key, String(isDocked));
        this.isDocked = isDocked;
    }

    /**
     * Restore dock state from localStorage
     * @param {boolean} defaultState - Default state if nothing saved
     * @returns {boolean} Whether the element should be docked
     */
    restoreDockState(defaultState = true) {
        const key = `${this.storagePrefix}-docked`;
        const saved = localStorage.getItem(key);

        if (saved === null) {
            return defaultState;
        }

        return saved === 'true';
    }

    /**
     * Apply CSS position to the element
     * @param {Object} position - Position object with CSS properties
     */
    applyPosition(position) {
        this.$element.css(position);
    }

    /**
     * Center the element in the window
     * @param {number} defaultWidth - Default width if element has no width
     * @param {number} defaultHeight - Default height if element has no height
     * @returns {Object} Position object with top and left
     */
    centerInWindow(defaultWidth = 600, defaultHeight = 300) {
        const width = this.$element.outerWidth() || defaultWidth;
        const height = this.$element.outerHeight() || defaultHeight;
        const left = ($(window).width() - width) / 2;
        const top = ($(window).height() - height) / 2;

        return { top, left };
    }
}