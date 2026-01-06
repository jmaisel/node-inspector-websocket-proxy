/**
 * ScopeController - Manages scope chain display
 *
 * Responsibilities:
 * - Render scope chain from template (with TemplateRegistry override support)
 * - Fetch scope variables when debugger pauses
 * - Display local, closure, and global scopes
 * - Show variable names and values
 *
 * Features:
 * - Automatic scope fetch on Debugger.paused events
 * - Display scope types (local, closure, global, etc.)
 * - Variable inspection via Runtime.getProperties
 */

import { TemplateRegistry } from '../core/TemplateRegistry.js';
import { scopeTemplate } from '../templates/scope-template.js';

export class ScopeController {
    constructor(config = {}) {
        this.eventQueue = config.eventQueue;
        this.proxy = config.proxy;
        this.container = config.container || '#scope';
        this.instanceId = config.instanceId || 'scope-' + Date.now();

        // State
        this.scopes = [];  // Array of { type, variables: [{ name, value }] }

        console.log('[ScopeController] Created');
    }

    /**
     * Initialize - render and setup
     */
    async initialize() {
        console.log('[ScopeController] Initializing...');

        // Render the template
        this.render();

        // Subscribe to events
        this.subscribeToEvents();

        console.log('[ScopeController] Initialized');
    }

    /**
     * Render scope chain from template (with TemplateRegistry override support)
     */
    render() {
        // Check TemplateRegistry first, fall back to default template
        const templateFn = TemplateRegistry.get('scope') || scopeTemplate;

        const html = templateFn({
            scopes: this.scopes
        }, {}, this.instanceId);

        // Insert into container
        $(this.container).html(html);

        console.log('[ScopeController] Rendered', this.scopes.length, 'scopes');
    }

    /**
     * Subscribe to events on the queue
     */
    subscribeToEvents() {
        // Fetch scope when debugger pauses
        this.eventQueue.subscribe('Debugger.paused', (topic, data) => {
            console.log('[ScopeController] Debugger paused, fetching scope');
            this.fetchScope(data);
        });

        // Clear scope when debugger resumes
        this.eventQueue.subscribe('Debugger.resumed', () => {
            console.log('[ScopeController] Debugger resumed, clearing scope');
            this.clearScope();
        });

        console.log('[ScopeController] Subscribed to queue events');
    }

    /**
     * Fetch scope chain for the current pause location
     * @param {Object} pauseData - Data from Debugger.paused event
     */
    async fetchScope(pauseData) {
        try {
            // Get the top call frame
            const callFrames = pauseData?.callFrames || [];
            if (callFrames.length === 0) {
                console.warn('[ScopeController] No call frames available');
                this.scopes = [];
                this.render();
                return;
            }

            const topFrame = callFrames[0];
            const scopeChain = topFrame.scopeChain || [];

            console.log('[ScopeController] Fetching', scopeChain.length, 'scopes');

            // Fetch variables for each scope
            this.scopes = [];
            for (const scope of scopeChain) {
                const scopeType = this.formatScopeType(scope.type);
                const scopeObject = scope.object;

                // Get properties of the scope object
                const variables = await this.getVariables(scopeObject);

                this.scopes.push({
                    type: scopeType,
                    variables: variables
                });
            }

            // Re-render with scope data
            this.render();

        } catch (error) {
            console.error('[ScopeController] Error fetching scope:', error);
            this.scopes = [];
            this.render();
        }
    }

    /**
     * Get variables for a scope object
     * @param {Object} scopeObject - RemoteObject representing the scope
     * @returns {Promise<Array>} Array of { name, value } objects
     */
    async getVariables(scopeObject) {
        try {
            if (!scopeObject || !scopeObject.objectId) {
                return [];
            }

            // Use Runtime.getProperties to get the properties
            const result = await this.proxy.runtimeController.getProperties(
                scopeObject.objectId,
                { ownProperties: true }
            );

            if (!result || !result.result) {
                return [];
            }

            // Map properties to { name, value } format
            const variables = result.result
                .filter(prop => !prop.isOwn === false)  // Only own properties
                .map(prop => ({
                    name: prop.name,
                    value: this.formatValue(prop.value)
                }));

            return variables;

        } catch (error) {
            console.error('[ScopeController] Error getting variables:', error);
            return [];
        }
    }

    /**
     * Format a RemoteObject value for display
     * @param {Object} remoteObject - Chrome DevTools Protocol RemoteObject
     * @returns {string} Formatted value
     */
    formatValue(remoteObject) {
        if (!remoteObject) {
            return 'undefined';
        }

        const type = remoteObject.type;
        const value = remoteObject.value;
        const description = remoteObject.description;

        switch (type) {
            case 'string':
                return `"${value}"`;
            case 'number':
            case 'boolean':
                return String(value);
            case 'undefined':
                return 'undefined';
            case 'object':
                if (remoteObject.subtype === 'null') {
                    return 'null';
                }
                if (remoteObject.subtype === 'array') {
                    return description || 'Array';
                }
                return description || 'Object';
            case 'function':
                return description || 'function';
            case 'symbol':
                return description || 'Symbol';
            case 'bigint':
                return String(value) + 'n';
            default:
                return description || String(value) || type;
        }
    }

    /**
     * Format scope type for display
     * @param {string} type - Scope type from CDP (local, closure, global, etc.)
     * @returns {string} Formatted type
     */
    formatScopeType(type) {
        const typeMap = {
            'local': 'Local',
            'closure': 'Closure',
            'global': 'Global',
            'with': 'With',
            'catch': 'Catch',
            'block': 'Block',
            'script': 'Script',
            'eval': 'Eval',
            'module': 'Module'
        };

        return typeMap[type] || type;
    }

    /**
     * Clear scope display
     */
    clearScope() {
        this.scopes = [];
        this.render();
    }
}
