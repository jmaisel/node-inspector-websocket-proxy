/**
 * Controllers Module - Entry point for all UI controllers
 *
 * This module imports and re-exports all controller classes for the debugger UI.
 * Import this single module instead of importing individual controller files.
 */

// Import all controller classes
import { BaseUIController } from './controllers/BaseUIController.js';
import { DockableUIController } from './controllers/DockableUIController.js';
import { ToolbarUIController } from './controllers/ToolbarUIController.js';
import { TabNavigationUIController } from './controllers/TabNavigationUIController.js';
import { ConsoleUIController } from './controllers/ConsoleUIController.js';
import { CallStackUIController } from './controllers/CallStackUIController.js';
import { DebuggerUIController } from './controllers/DebuggerUIController.js';
import { FileTreeUIController } from './controllers/FileTreeUIController.js';

// Re-export all classes
export {
    BaseUIController,
    DockableUIController,
    ToolbarUIController,
    TabNavigationUIController,
    ConsoleUIController,
    CallStackUIController,
    DebuggerUIController,
    FileTreeUIController
};