/**
 * TemplateRegistry - Global registry for template overrides
 *
 * Allows consumers to register custom templates before view instantiation.
 * Templates are functions that take (data, config, instanceId) and return HTML strings.
 *
 * @example
 * TemplateRegistry.register('toolbar', (data, config, instanceId) => {
 *   return `<div id="${instanceId}">Custom toolbar</div>`;
 * });
 */
export class TemplateRegistry {
    static templates = new Map();

    /**
     * Register a template override for a component
     * @param {string} componentName - Name of the component (e.g., 'toolbar', 'console')
     * @param {Function} templateFn - Template function: (data, config, instanceId) => htmlString
     */
    static register(componentName, templateFn) {
        if (typeof componentName !== 'string' || !componentName) {
            throw new Error('Component name must be a non-empty string');
        }

        if (typeof templateFn !== 'function') {
            throw new Error('Template must be a function');
        }

        this.templates.set(componentName, templateFn);
    }

    /**
     * Get a registered template by component name
     * @param {string} componentName - Name of the component
     * @returns {Function|undefined} The template function or undefined if not registered
     */
    static get(componentName) {
        return this.templates.get(componentName);
    }

    /**
     * Check if a template override exists for a component
     * @param {string} componentName - Name of the component
     * @returns {boolean} True if an override exists
     */
    static has(componentName) {
        return this.templates.has(componentName);
    }

    /**
     * Clear all registered templates (useful for testing)
     */
    static clear() {
        this.templates.clear();
    }

    /**
     * Register multiple templates at once
     * @param {Object} templateMap - Object mapping component names to template functions
     * @example
     * TemplateRegistry.registerAll({
     *   toolbar: (data, config, id) => `<div id="${id}">...</div>`,
     *   console: (data, config, id) => `<div id="${id}">...</div>`
     * });
     */
    static registerAll(templateMap) {
        if (typeof templateMap !== 'object' || templateMap === null) {
            throw new Error('Template map must be an object');
        }

        Object.entries(templateMap).forEach(([name, fn]) => {
            this.register(name, fn);
        });
    }

    /**
     * Get all registered component names
     * @returns {string[]} Array of registered component names
     */
    static getRegisteredNames() {
        return Array.from(this.templates.keys());
    }

    /**
     * Remove a specific template registration
     * @param {string} componentName - Name of the component to unregister
     * @returns {boolean} True if the template was removed
     */
    static unregister(componentName) {
        return this.templates.delete(componentName);
    }
}