import { BaseView } from './BaseView.js';
import { getLocalStorage, setLocalStorage } from './ViewUtils.js';

/**
 * DockableView - Base class for views that support docking/undocking
 *
 * Extends BaseView with:
 * - Docking/undocking behavior
 * - Position persistence (localStorage)
 * - jQuery UI draggable integration
 * - jQuery UI resizable integration
 * - Dock zone detection and snapping
 *
 * Subclasses must implement:
 * - dock(): Dock the element to its designated position
 * - undock(): Undock the element (make it floating)
 */
export class DockableView extends BaseView {
    /**
     * @param {Object} config - Configuration object
     * @param {string} [config.dockZone] - CSS selector for dock zone
     * @param {Object} [config.draggableConfig] - jQuery UI draggable configuration
     * @param {Object} [config.resizableConfig] - jQuery UI resizable configuration
     * @param {string} [config.storagePrefix] - Prefix for localStorage keys
     */
    constructor(config = {}) {
        super(config);

        this.dockZone = config.dockZone || null;
        this.draggableConfig = config.draggableConfig || {};
        this.resizableConfig = config.resizableConfig || null;
        this.storagePrefix = config.storagePrefix || this.getComponentName();
        this.isDocked = true;
    }

    /**
     * Dock the element to its designated position
     * Subclasses must implement this
     */
    dock() {
        throw new Error(`${this.constructor.name} must implement dock()`);
    }

    /**
     * Undock the element (make it floating)
     * Subclasses must implement this
     */
    undock() {
        throw new Error(`${this.constructor.name} must implement undock()`);
    }

    /**
     * Check if element is currently docked
     * @returns {boolean} True if docked
     */
    isDockedState() {
        return this.isDocked;
    }

    /**
     * Initialize jQuery UI draggable
     * @param {Object} [config] - Additional draggable configuration
     */
    initDraggable(config = {}) {
        if (!this.$element) {
            throw new Error('Cannot initialize draggable: element not mounted');
        }

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
        if (this.$element && this.$element.data('ui-draggable')) {
            this.$element.draggable(enabled ? 'enable' : 'disable');
        }
    }

    /**
     * Destroy draggable functionality
     */
    destroyDraggable() {
        if (this.$element && this.$element.data('ui-draggable')) {
            this.$element.draggable('destroy');
        }
    }

    /**
     * Initialize jQuery UI resizable
     * @param {Object} [config] - Additional resizable configuration
     */
    initResizable(config = {}) {
        if (!this.$element) {
            throw new Error('Cannot initialize resizable: element not mounted');
        }

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
        if (this.$element && this.$element.data('ui-resizable')) {
            this.$element.resizable(enabled ? 'enable' : 'disable');
        }
    }

    /**
     * Update resizable options
     * @param {string} option - Option name
     * @param {*} value - Option value
     */
    setResizableOption(option, value) {
        if (this.$element && this.$element.data('ui-resizable')) {
            this.$element.resizable('option', option, value);
        }
    }

    /**
     * Destroy resizable functionality
     */
    destroyResizable() {
        if (this.$element && this.$element.data('ui-resizable')) {
            this.$element.resizable('destroy');
        }
    }

    /**
     * Save current position to localStorage
     * @param {Object} position - Position object with top and left
     */
    savePosition(position) {
        const key = `${this.storagePrefix}-dock-pos`;
        setLocalStorage(key, {
            top: position.top,
            left: position.left
        });
    }

    /**
     * Restore position from localStorage
     * @returns {Object|null} Position object with top and left, or null if not saved
     */
    restorePosition() {
        const key = `${this.storagePrefix}-dock-pos`;
        return getLocalStorage(key, null);
    }

    /**
     * Clear saved position from localStorage
     */
    clearPosition() {
        const key = `${this.storagePrefix}-dock-pos`;
        localStorage.removeItem(key);
    }

    /**
     * Save dock state to localStorage
     * @param {boolean} isDocked - Whether the element is docked
     */
    saveDockState(isDocked) {
        const key = `${this.storagePrefix}-docked`;
        setLocalStorage(key, isDocked);
        this.isDocked = isDocked;
    }

    /**
     * Restore dock state from localStorage
     * @param {boolean} [defaultState=true] - Default state if nothing saved
     * @returns {boolean} Whether the element should be docked
     */
    restoreDockState(defaultState = true) {
        const key = `${this.storagePrefix}-docked`;
        const saved = getLocalStorage(key, null);

        if (saved === null) {
            return defaultState;
        }

        this.isDocked = saved;
        return saved;
    }

    /**
     * Apply CSS position to the element
     * @param {Object} position - Position object with CSS properties
     */
    applyPosition(position) {
        if (this.$element) {
            this.$element.css(position);
        }
    }

    /**
     * Center element in the window
     * @param {number} [defaultWidth=600] - Default width if element has no width
     * @param {number} [defaultHeight=300] - Default height if element has no height
     * @returns {Object} Position object with top and left
     */
    centerInWindow(defaultWidth = 600, defaultHeight = 300) {
        if (!this.$element) {
            throw new Error('Cannot center: element not mounted');
        }

        const width = this.$element.outerWidth() || defaultWidth;
        const height = this.$element.outerHeight() || defaultHeight;
        const left = ($(window).width() - width) / 2;
        const top = ($(window).height() - height) / 2;

        return { top, left };
    }

    /**
     * Get dock zone jQuery element
     * @returns {jQuery|null} Dock zone element or null
     */
    getDockZone() {
        if (!this.dockZone) {
            return null;
        }
        return $(this.dockZone);
    }

    /**
     * Set dock zone selector
     * @param {string} selector - CSS selector for dock zone
     */
    setDockZone(selector) {
        this.dockZone = selector;
    }

    /**
     * Check if element is near dock zone
     * @param {Object} position - Position object with top and left
     * @param {number} [threshold=50] - Distance threshold in pixels
     * @returns {boolean} True if near dock zone
     */
    isNearDockZone(position, threshold = 50) {
        const $zone = this.getDockZone();
        if (!$zone || $zone.length === 0) {
            return false;
        }

        const zoneOffset = $zone.offset();
        const zoneHeight = $zone.outerHeight();
        const zoneWidth = $zone.outerWidth();

        return (
            position.top >= zoneOffset.top - threshold &&
            position.top <= zoneOffset.top + zoneHeight + threshold &&
            position.left >= zoneOffset.left - threshold &&
            position.left <= zoneOffset.left + zoneWidth + threshold
        );
    }

    /**
     * Add pulsate effect to dock zone
     */
    highlightDockZone() {
        const $zone = this.getDockZone();
        if ($zone && $zone.length > 0) {
            $zone.addClass('pulsate-dock-target');
        }
    }

    /**
     * Remove pulsate effect from dock zone
     */
    unhighlightDockZone() {
        const $zone = this.getDockZone();
        if ($zone && $zone.length > 0) {
            $zone.removeClass('pulsate-dock-target');
        }
    }

    /**
     * Override unmount to clean up draggable/resizable
     */
    unmount() {
        // Clean up jQuery UI
        this.destroyDraggable();
        this.destroyResizable();

        // Call parent unmount
        super.unmount();
    }

    /**
     * Save current size to localStorage
     * @param {Object} size - Size object with width and height
     */
    saveSize(size) {
        const key = `${this.storagePrefix}-size`;
        setLocalStorage(key, {
            width: size.width,
            height: size.height
        });
    }

    /**
     * Restore size from localStorage
     * @returns {Object|null} Size object with width and height, or null if not saved
     */
    restoreSize() {
        const key = `${this.storagePrefix}-size`;
        return getLocalStorage(key, null);
    }

    /**
     * Apply size to element
     * @param {Object} size - Size object with width and height
     */
    applySize(size) {
        if (this.$element) {
            this.$element.css({
                width: size.width,
                height: size.height
            });
        }
    }
}
