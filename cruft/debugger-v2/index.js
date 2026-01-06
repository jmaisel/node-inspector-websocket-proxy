/**
 * Debugger v2 - Public API
 *
 * Simplified event-driven architecture for embeddable debugger.
 * Components use templates with TemplateRegistry override support.
 *
 * Usage:
 *   import { DebuggerApplication, TemplateRegistry } from './debugger-v2/index.js';
 *
 *   // Optional: Register custom templates
 *   TemplateRegistry.register('toolbar', customToolbarTemplate);
 *
 *   // Create and initialize debugger
 *   const app = new DebuggerApplication({
 *       container: '#debugger-root',
 *       wsUrl: 'ws://localhost:8888'
 *   });
 *   await app.initialize();
 */

// Core
export { DebuggerApplication } from './core/DebuggerApplication.js';
export { TemplateRegistry } from './core/TemplateRegistry.js';
export * as ViewUtils from './core/ViewUtils.js';

// Controllers (all 8 controllers are now implemented)
export { ToolbarController } from './controllers/ToolbarController.js';
export { TabSystemController } from './controllers/TabSystemController.js';
export { ConsoleController } from './controllers/ConsoleController.js';
export { FileTreeController } from './controllers/FileTreeController.js';
export { CallStackController } from './controllers/CallStackController.js';
export { BreakpointController } from './controllers/BreakpointController.js';
export { WatchesController } from './controllers/WatchesController.js';
export { ScopeController } from './controllers/ScopeController.js';

// Templates (all 8 templates are complete)
export { toolbarTemplate } from './templates/toolbar-template.js';
export { consoleTemplate } from './templates/console-template.js';
export { tabSystemTemplate } from './templates/tab-system-template.js';
export { fileTreeTemplate } from './templates/file-tree-template.js';
export { callstackTemplate } from './templates/callstack-template.js';
export { breakpointListTemplate } from './templates/breakpoint-list-template.js';
export { watchesTemplate } from './templates/watches-template.js';
export { scopeTemplate } from './templates/scope-template.js';
