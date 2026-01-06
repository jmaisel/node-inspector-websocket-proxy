import { TemplateRegistry } from './TemplateRegistry.js';
import { generateUniqueId, buildElementId, idToSelector, validateElements } from './ViewUtils.js';

/**
 * BaseView - Abstract base class for all views
 *
 * Provides core functionality:
 * - Template management and registration
 * - HTML generation from templates
 * - Element mapping (logical names to selectors/DOM elements)
 * - Mount/unmount lifecycle
 * - State management
 * - Event handling setup
 *
 * Subclasses must implement:
 * - getDefaultTemplate(): Return default template function
 * - defineElementMap(): Return logical name → ID suffix mapping
 */
export class BaseView {
    /**
     * @param {Object} config - Configuration object
     * @param {string} [config.container] - CSS selector for mount container
     * @param {Object} [config.initialState] - Initial state data
     * @param {Function} [config.template] - Custom template function (alternative to registry)
     */
    constructor(config = {}) {
        this.config = config;
        this.instanceId = this.generateInstanceId();
        this.mounted = false;
        this.state = config.initialState || {};
        this.elementMap = null;
        this.$element = null;
        this.$container = null;
        this.customTemplate = config.template || null;
        this.eventHandlers = [];
    }

    /**
     * Generate unique instance ID for this view
     * @returns {string} Unique ID
     */
    generateInstanceId() {
        const componentName = this.getComponentName();
        return generateUniqueId(componentName);
    }

    /**
     * Get component name from class name
     * Converts ToolbarView → 'toolbar', ConsoleView → 'console'
     * @returns {string} Component name
     */
    getComponentName() {
        return this.constructor.name.replace('View', '').toLowerCase();
    }

    /**
     * Define element map structure
     * Subclasses override this to specify their DOM elements
     *
     * @returns {Object} Map of logical name → ID suffix
     * @example
     * return {
     *   container: '',
     *   connectBtn: '-connect-btn',
     *   wsUrlInput: '-ws-url'
     * }
     */
    defineElementMap() {
        return {
            container: ''
        };
    }

    /**
     * Build element map with selectors or DOM references
     * Before mount: returns selectors (#id)
     * After mount: returns DOM elements
     * @returns {Object} Element map
     */
    getElementMap() {
        if (!this.elementMap || this.mounted) {
            this.buildElementMap();
        }
        return this.elementMap;
    }

    /**
     * Build element map based on mount state
     * @private
     */
    buildElementMap() {
        const mapDefinition = this.defineElementMap();
        this.elementMap = {};

        for (const [logicalName, suffixOrObject] of Object.entries(mapDefinition)) {
            // Handle nested objects (e.g., tabs: { console: '-tab-console', ... })
            if (typeof suffixOrObject === 'object' && suffixOrObject !== null && !Array.isArray(suffixOrObject)) {
                this.elementMap[logicalName] = {};
                for (const [nestedName, nestedSuffix] of Object.entries(suffixOrObject)) {
                    const elementId = buildElementId(this.instanceId, nestedSuffix);

                    if (this.mounted) {
                        const element = document.getElementById(elementId);
                        this.elementMap[logicalName][nestedName] = element;
                    } else {
                        this.elementMap[logicalName][nestedName] = idToSelector(elementId);
                    }
                }
            } else {
                // Handle simple string suffix
                const elementId = buildElementId(this.instanceId, suffixOrObject);

                if (this.mounted) {
                    // Return DOM element reference
                    const element = document.getElementById(elementId);
                    this.elementMap[logicalName] = element;
                } else {
                    // Return selector string
                    this.elementMap[logicalName] = idToSelector(elementId);
                }
            }
        }
    }

    /**
     * Get template function to use for rendering
     * Priority: custom template > registry > default
     * @returns {Function} Template function
     */
    getTemplate() {
        // 1. Check for custom template passed in config
        if (this.customTemplate) {
            return this.customTemplate;
        }

        // 2. Check template registry
        const componentName = this.getComponentName();
        if (TemplateRegistry.has(componentName)) {
            return TemplateRegistry.get(componentName);
        }

        // 3. Fall back to default template
        return this.getDefaultTemplate();
    }

    /**
     * Get default template function
     * Subclasses must implement this
     * @returns {Function} Default template function: (data, config, instanceId) => htmlString
     */
    getDefaultTemplate() {
        throw new Error(`${this.constructor.name} must implement getDefaultTemplate()`);
    }

    /**
     * Render HTML from template
     * @param {Object} [data] - Data to pass to template (defaults to current state)
     * @returns {string} Generated HTML string
     */
    render(data = null) {
        const renderData = data !== null ? data : this.state;
        const template = this.getTemplate();

        try {
            return template(renderData, this.config, this.instanceId);
        } catch (error) {
            console.error(`Error rendering ${this.getComponentName()} view:`, error);
            throw error;
        }
    }

    /**
     * Mount view to container
     * @param {string} [containerSelector] - CSS selector for container (overrides config)
     * @returns {Promise<void>}
     */
    async mount(containerSelector = null) {
        if (this.mounted) {
            console.warn(`${this.getComponentName()} view is already mounted`);
            return;
        }

        // Determine container
        const selector = containerSelector || this.config.container;
        if (!selector) {
            throw new Error(`No container specified for ${this.getComponentName()} view`);
        }

        this.$container = $(selector);
        if (this.$container.length === 0) {
            throw new Error(`Container not found: ${selector}`);
        }

        // Generate and insert HTML
        const html = this.render();
        this.$container.append(html);

        // Get reference to mounted element
        this.$element = $(`#${this.instanceId}`);
        if (this.$element.length === 0) {
            throw new Error(`Failed to mount ${this.getComponentName()} view: element not found after insertion`);
        }

        this.mounted = true;

        // Rebuild element map with DOM references
        this.buildElementMap();

        // Validate that all elements exist
        this.validateMountedElements();

        // Attach event handlers
        await this.attachEvents();

        // Call lifecycle hook
        await this.onMounted();
    }

    /**
     * Validate that all required elements exist after mount
     * @private
     */
    validateMountedElements() {
        const elements = this.getElementMap();
        const missing = [];

        const checkElement = (name, element) => {
            if (typeof element === 'object' && element !== null && !element.nodeType) {
                // It's a nested object, check its contents
                for (const [nestedName, nestedElement] of Object.entries(element)) {
                    if (!nestedElement) {
                        missing.push(`${name}.${nestedName}`);
                    }
                }
            } else if (!element) {
                missing.push(name);
            }
        };

        for (const [logicalName, element] of Object.entries(elements)) {
            checkElement(logicalName, element);
        }

        if (missing.length > 0) {
            console.warn(
                `${this.getComponentName()} view is missing elements: ${missing.join(', ')}. ` +
                `This may indicate a template mismatch.`
            );
        }
    }

    /**
     * Unmount view from DOM
     */
    unmount() {
        if (!this.mounted) {
            return;
        }

        // Detach event handlers
        this.detachEvents();

        // Call lifecycle hook
        this.onUnmounted();

        // Remove from DOM
        if (this.$element) {
            this.$element.remove();
            this.$element = null;
        }

        this.mounted = false;
        this.elementMap = null;
        this.$container = null;
    }

    /**
     * Update view with new data
     * Re-renders the view and replaces content
     * @param {Object} partialState - Partial state to merge with current state
     */
    update(partialState = {}) {
        if (!this.mounted) {
            throw new Error(`Cannot update unmounted ${this.getComponentName()} view`);
        }

        // Merge new state
        this.setState(partialState);

        // Re-render
        const html = this.render();

        // Store scroll position
        const scrollTop = this.$element[0]?.scrollTop || 0;

        // Replace content
        const $newElement = $(html);
        this.$element.replaceWith($newElement);
        this.$element = $newElement;

        // Restore scroll position
        if (this.$element[0]) {
            this.$element[0].scrollTop = scrollTop;
        }

        // Rebuild element map
        this.buildElementMap();

        // Reattach events
        this.detachEvents();
        this.attachEvents();
    }

    /**
     * Set view state (merges with existing state)
     * @param {Object} newState - State to merge
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    /**
     * Get current view state
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Attach event handlers
     * Subclasses override this to bind events
     * @returns {Promise<void>}
     */
    async attachEvents() {
        // Subclasses implement this
    }

    /**
     * Detach all event handlers
     */
    detachEvents() {
        // Remove all registered handlers
        this.eventHandlers.forEach(({ element, event, handler }) => {
            $(element).off(event, handler);
        });
        this.eventHandlers = [];
    }

    /**
     * Register an event handler for cleanup
     * @param {string|HTMLElement|jQuery} element - Element or selector
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     */
    registerEventHandler(element, event, handler) {
        this.eventHandlers.push({ element, event, handler });
        $(element).on(event, handler);
    }

    /**
     * Lifecycle hook: called after mount completes
     * Subclasses can override
     * @returns {Promise<void>}
     */
    async onMounted() {
        // Subclasses can override
    }

    /**
     * Lifecycle hook: called before unmount
     * Subclasses can override
     */
    onUnmounted() {
        // Subclasses can override
    }

    /**
     * Get jQuery element reference
     * @returns {jQuery} jQuery element
     */
    getElement() {
        return this.$element;
    }

    /**
     * Check if view is mounted
     * @returns {boolean} True if mounted
     */
    isMounted() {
        return this.mounted;
    }

    /**
     * Get view instance ID
     * @returns {string} Instance ID
     */
    getInstanceId() {
        return this.instanceId;
    }
}
