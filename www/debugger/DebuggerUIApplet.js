/**
 * DebuggerUIApplet - Configuration-based debugger UI initialization
 *
 * Centralizes the mapping between templates, controllers, and target DOM elements.
 * Eliminates repetitive initialization code by using a declarative configuration.
 *
 * Features:
 * - Automatic template registration (custom or default)
 * - Automatic controller instantiation and mounting
 * - Declarative component configuration
 * - Support for both dashboard and tab-based layouts
 *
 * @example
 * // Basic usage with default templates
 * const applet = new DebuggerUIApplet({
 *   components: {
 *     toolbar: { target: '#toolbar-container' },
 *     console: { target: '#console-container' }
 *   }
 * });
 * applet.initialize();
 *
 * @example
 * // Advanced usage with custom templates
 * const applet = new DebuggerUIApplet({
 *   templates: {
 *     toolbar: customToolbarTemplate,
 *     console: consoleTemplate  // default
 *   },
 *   components: {
 *     toolbar: {
 *       target: '#toolbar-container',
 *       settingsTarget: '#settings-container',
 *       options: { instanceId: 'main-toolbar' }
 *     },
 *     console: {
 *       target: '#console-container',
 *       dockTarget: '#console-dock-container'
 *     }
 *   }
 * });
 */

import { TemplateRegistry } from './TemplateRegistry.js';
import {
    ToolbarUIController,
    TabNavigationUIController,
    ConsoleUIController,
    DebuggerUIController,
    CallStackUIController,
    FileTreeUIController,
    BreakpointUIController
} from './controllers.js';

// Import default templates
import { toolbarTemplate } from './templates/toolbar-template.js';
import { tabNavigationTemplate } from './templates/tab-navigation-template.js';
import { consoleTemplate } from './templates/console-template.js';
import { callStackTemplate } from './templates/callstack-template.js';
import { fileTreeTemplate } from './templates/file-tree-template.js';
import { breakpointsTemplate } from './templates/breakpoints-template.js';

/**
 * Component type mappings - Maps component names to their controller classes
 */
const COMPONENT_CONTROLLERS = {
    toolbar: ToolbarUIController,
    tabNavigation: TabNavigationUIController,
    console: ConsoleUIController,
    debugger: DebuggerUIController,
    callStack: CallStackUIController,
    fileTree: FileTreeUIController,
    breakpoints: BreakpointUIController
};

/**
 * Template name mappings - Maps component names to template registry keys
 */
const COMPONENT_TEMPLATE_KEYS = {
    toolbar: 'toolbar',
    tabNavigation: 'tab-navigation',
    console: 'console',
    callStack: 'callstack',
    fileTree: 'filetree',
    breakpoints: 'breakpoints'
};

/**
 * Default templates - Automatically registered if no custom template provided
 */
const DEFAULT_TEMPLATES = {
    toolbar: toolbarTemplate,
    tabNavigation: tabNavigationTemplate,
    console: consoleTemplate,
    callStack: callStackTemplate,
    fileTree: fileTreeTemplate,
    breakpoints: breakpointsTemplate
};

/**
 * Default instance IDs for components
 */
const DEFAULT_INSTANCE_IDS = {
    toolbar: 'toolbar',
    tabNavigation: 'tab-nav',
    console: 'console',
    callStack: 'callstack',
    fileTree: 'files',
    breakpoints: 'breakpoints'
};

export class DebuggerUIApplet {
    /**
     * Create a new DebuggerUIApplet
     *
     * @param {Object} config - Configuration object
     * @param {Object} config.templates - Template functions to register
     * @param {Object} config.components - Component configurations
     * @param {Object} config.defaults - Default options for all components
     * @param {boolean} config.autoInit - Automatically initialize on DOM ready (default: false)
     * @param {boolean} config.verbose - Enable verbose logging (default: true)
     */
    constructor(config = {}) {
        this.config = {
            templates: config.templates || {},
            components: config.components || {},
            defaults: config.defaults || {},
            autoInit: config.autoInit || false,
            verbose: config.verbose !== false  // Default to true
        };

        this.controllers = {};
        this.initialized = false;

        this.log('📦 DebuggerUIApplet created with config:', this.config);

        // Auto-initialize if requested
        if (this.config.autoInit) {
            $(document).ready(() => this.initialize());
        }
    }

    /**
     * Log message if verbose mode is enabled
     */
    log(...args) {
        if (this.config.verbose) {
            console.log('🎯 [Applet]', ...args);
        }
    }

    /**
     * Register all templates from configuration
     * Automatically uses default templates for components not in config
     */
    registerTemplates() {
        this.log('📝 Registering templates...');

        const customTemplates = [];
        const defaultTemplates = [];

        // First, determine which components are enabled
        const enabledComponents = Object.keys(this.config.components);

        // Register templates for enabled components
        for (const componentName of enabledComponents) {
            const templateKey = COMPONENT_TEMPLATE_KEYS[componentName] || componentName;

            // Skip components that don't have templates (like debugger)
            if (!DEFAULT_TEMPLATES[componentName]) {
                continue;
            }

            let template;
            let isCustom = false;

            // Check if custom template provided
            if (this.config.templates[componentName]) {
                template = this.config.templates[componentName];
                isCustom = true;
            } else {
                // Use default template
                template = DEFAULT_TEMPLATES[componentName];
            }

            if (typeof template === 'function') {
                TemplateRegistry.register(templateKey, template);
                if (isCustom) {
                    customTemplates.push(componentName);
                } else {
                    defaultTemplates.push(componentName);
                }
            } else {
                console.warn(`⚠️ Template for "${componentName}" is not a function, skipping`);
            }
        }

        this.log(`✅ Registered ${customTemplates.length + defaultTemplates.length} templates`);
        if (customTemplates.length > 0) {
            this.log(`   🎨 Custom: ${customTemplates.join(', ')}`);
        }
        if (defaultTemplates.length > 0) {
            this.log(`   📦 Default: ${defaultTemplates.join(', ')}`);
        }
    }

    /**
     * Create and configure a single controller
     *
     * @param {string} componentName - Name of the component
     * @param {Object} componentConfig - Configuration for this component
     * @returns {Object} Controller instance
     */
    createController(componentName, componentConfig) {
        const ControllerClass = COMPONENT_CONTROLLERS[componentName];

        if (!ControllerClass) {
            throw new Error(`Unknown component type: ${componentName}`);
        }

        // Special handling for debugger controller (no config needed)
        if (componentName === 'debugger') {
            return new ControllerClass(this);
        }

        // Merge default options with component-specific options
        const options = {
            debuggerUI: this,
            instanceId: componentConfig.instanceId || DEFAULT_INSTANCE_IDS[componentName],
            skipRender: false,
            ...this.config.defaults,
            ...(componentConfig.options || {})
        };

        // Special handling for toolbar's zoneSelector
        if (componentName === 'toolbar' && !options.zoneSelector) {
            options.zoneSelector = '#toolbarDockZone';
        }

        // Special handling for tab navigation's tabs config
        if (componentName === 'tabNavigation' && componentConfig.tabs) {
            options.tabs = componentConfig.tabs;
        }

        return new ControllerClass(options);
    }

    /**
     * Mount a controller to its target element(s)
     *
     * @param {string} componentName - Name of the component
     * @param {Object} controller - Controller instance
     * @param {Object} componentConfig - Configuration for this component
     */
    mountController(componentName, controller, componentConfig) {
        const { target, settingsTarget, dockTarget } = componentConfig;

        if (!target) {
            throw new Error(`No target specified for component: ${componentName}`);
        }

        this.log(`  📍 Mounting ${componentName} to: ${target}`);

        // Different mount signatures for different components
        switch (componentName) {
            case 'toolbar':
                controller.mount(target, settingsTarget);
                break;

            case 'console':
                controller.mount(target, dockTarget);
                break;

            default:
                controller.mount(target);
                break;
        }
    }

    /**
     * Initialize all controllers in the correct order
     */
    async initializeControllers() {
        this.log('🔧 Initializing controllers...');

        // Get ordered list of components
        const componentOrder = this.getComponentOrder();

        for (const componentName of componentOrder) {
            const controller = this.controllers[componentName];

            if (controller && typeof controller.initialize === 'function') {
                this.log(`  ⚙️ Initializing ${componentName}...`);

                // FileTreeController.initialize() is async
                if (componentName === 'fileTree') {
                    await controller.initialize();
                } else {
                    controller.initialize();
                }
            }
        }

        this.log('✅ All controllers initialized');
    }

    /**
     * Determine initialization order for components
     * Some components need to be initialized before others
     */
    getComponentOrder() {
        const components = Object.keys(this.controllers);
        const order = [];

        // Prioritize certain components
        const priority = ['toolbar', 'tabNavigation', 'console', 'callStack', 'fileTree', 'breakpoints', 'debugger'];

        for (const key of priority) {
            if (components.includes(key)) {
                order.push(key);
            }
        }

        // Add remaining components
        for (const key of components) {
            if (!order.includes(key)) {
                order.push(key);
            }
        }

        return order;
    }

    /**
     * Get a controller by name
     *
     * @param {string} componentName - Name of the component
     * @returns {Object} Controller instance
     */
    getController(componentName) {
        return this.controllers[componentName];
    }

    /**
     * Convenience getters for backward compatibility
     * DebuggerUIController expects properties like 'fileTreeController', not 'controllers.fileTree'
     */
    get fileTreeController() {
        return this.controllers.fileTree;
    }

    get consoleController() {
        return this.controllers.console;
    }

    get breakpointController() {
        return this.controllers.breakpoints;
    }

    get callStackController() {
        return this.controllers.callStack;
    }

    get debuggerController() {
        return this.controllers.debugger;
    }

    get toolbarController() {
        return this.controllers.toolbar;
    }

    get tabNavigationController() {
        return this.controllers.tabNavigation;
    }

    /**
     * Check if a component is enabled in the configuration
     *
     * @param {string} componentName - Name of the component
     * @returns {boolean}
     */
    isComponentEnabled(componentName) {
        return componentName in this.config.components;
    }

    /**
     * Main initialization method
     * Orchestrates template registration, controller creation, mounting, and initialization
     */
    async initialize() {
        if (this.initialized) {
            console.warn('⚠️ DebuggerUIApplet already initialized');
            return;
        }

        this.log('🚀 Initializing DebuggerUIApplet...');

        // Step 1: Register templates
        this.registerTemplates();

        // Step 2: Create all controllers
        this.log('🏗️ Creating controllers...');
        for (const [componentName, componentConfig] of Object.entries(this.config.components)) {
            try {
                this.log(`  🔨 Creating ${componentName} controller...`);
                this.controllers[componentName] = this.createController(componentName, componentConfig);
            } catch (error) {
                console.error(`❌ Failed to create ${componentName} controller:`, error);
                throw error;
            }
        }

        // Step 3: Mount all controllers (except debugger which has no UI)
        this.log('📌 Mounting controllers...');
        for (const [componentName, componentConfig] of Object.entries(this.config.components)) {
            if (componentName === 'debugger') continue;  // Debugger has no mount

            try {
                const controller = this.controllers[componentName];
                this.mountController(componentName, controller, componentConfig);
            } catch (error) {
                console.error(`❌ Failed to mount ${componentName} controller:`, error);
                throw error;
            }
        }

        // Step 4: Initialize all controllers
        await this.initializeControllers();

        this.initialized = true;
        this.log('✨ DebuggerUIApplet initialization complete!');
        this.log('📊 Active controllers:', Object.keys(this.controllers));
    }

    /**
     * Clean up and destroy the applet
     */
    destroy() {
        this.log('🧹 Destroying DebuggerUIApplet...');

        // Call destroy on all controllers that have it
        for (const [name, controller] of Object.entries(this.controllers)) {
            if (typeof controller.destroy === 'function') {
                controller.destroy();
            }
        }

        this.controllers = {};
        this.initialized = false;

        this.log('✅ DebuggerUIApplet destroyed');
    }
}

/**
 * Helper function to create a basic dashboard configuration
 *
 * @param {Object} customTemplates - Optional custom template overrides
 * @returns {Object} Configuration object
 */
export function createDashboardConfig(customTemplates = {}) {
    return {
        templates: customTemplates,  // Only custom templates needed, defaults auto-applied
        components: {
            toolbar: {
                target: '#toolbar-container',
                settingsTarget: '#settings-container'
            },
            console: {
                target: '#console-container',
                dockTarget: '#console-dock-container'
            },
            callStack: {
                target: '#callstack-container'
            },
            fileTree: {
                target: '#files-container'
            },
            breakpoints: {
                target: '#breakpoints-container'
            },
            debugger: {}
        }
    };
}

/**
 * Helper function to create a tabbed UI configuration
 *
 * @param {Object} customTemplates - Optional custom template overrides
 * @param {Array} tabs - Tab configuration
 * @returns {Object} Configuration object
 */
export function createTabbedConfig(customTemplates = {}, tabs = null) {
    const defaultTabs = [
        { name: 'console', label: 'Console', paneId: 'console-tab-pane' },
        { name: 'callstack', label: 'Call Stack', paneId: 'callstack-tab-pane' },
        { name: 'files', label: 'Files', paneId: 'tab-files' },
        { name: 'breakpoints', label: 'Breakpoints', paneId: 'breakpoints-tab-pane' },
        { name: 'scope', label: 'Scope', paneId: 'tab-scope' }
    ];

    return {
        templates: customTemplates,  // Only custom templates needed, defaults auto-applied
        components: {
            toolbar: {
                target: '#toolbar-container',
                settingsTarget: '#settings-container'
            },
            tabNavigation: {
                target: '#content',
                tabs: tabs || defaultTabs
            },
            console: {
                target: '#tab-content-container',
                dockTarget: '#console-dock-container'
            },
            callStack: {
                target: '#tab-content-container'
            },
            fileTree: {
                target: '#tab-content-container'
            },
            breakpoints: {
                target: '#tab-content-container'
            },
            debugger: {}
        }
    };
}