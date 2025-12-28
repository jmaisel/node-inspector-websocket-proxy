/**
 * TemplateRegistry - Centralized registry for UI component templates
 *
 * Allows custom templates to be registered for any component, enabling:
 * - Standalone mode: Components use default templates
 * - Embedded mode: Host apps provide custom templates
 * - Testing: Mock templates can be injected
 *
 * Template function signature:
 * function(data, instanceId) => string (HTML)
 *
 * @example
 * // Register custom template
 * TemplateRegistry.register('console', (data, instanceId) => {
 *   return `<div id="${instanceId}">${data.content}</div>`;
 * });
 *
 * // Use in controller
 * const template = TemplateRegistry.get('console') || defaultTemplate;
 * const html = template({ content: 'Hello' }, 'my-console');
 */
export class TemplateRegistry {
    static templates = new Map();

    /**
     * Register a template function
     * @param {string} name - Template name (e.g., 'console', 'toolbar')
     * @param {Function} templateFn - Template function (data, instanceId) => HTML string
     */
    static register(name, templateFn) {
        if (typeof templateFn !== 'function') {
            throw new Error(`Template for "${name}" must be a function`);
        }
        this.templates.set(name, templateFn);
    }

    /**
     * Get a registered template
     * @param {string} name - Template name
     * @returns {Function|null} Template function or null if not found
     */
    static get(name) {
        return this.templates.get(name) || null;
    }

    /**
     * Check if a template is registered
     * @param {string} name - Template name
     * @returns {boolean}
     */
    static has(name) {
        return this.templates.has(name);
    }

    /**
     * Unregister a template
     * @param {string} name - Template name
     */
    static unregister(name) {
        this.templates.delete(name);
    }

    /**
     * Clear all registered templates
     */
    static clear() {
        this.templates.clear();
    }
}

/**
 * Utility to escape HTML in template strings
 * @param {string} str - String to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Generate a unique instance ID for components
 * @param {string} prefix - Prefix for the ID (e.g., 'console', 'toolbar')
 * @returns {string} Unique ID
 */
export function generateInstanceId(prefix = 'component') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}