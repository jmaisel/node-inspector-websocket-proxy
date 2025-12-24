/**
 * BaseUIController - Base class for all UI controllers
 *
 * Provides a common foundation for all UI controllers in the debugger application.
 * Controllers handle specific domains of the UI (toolbar, console, file tree, etc.)
 * and encapsulate their state, behavior, and event handling.
 */
class BaseUIController {
    constructor() {
        // Base initialization - can be extended in the future
    }

    /**
     * Initialize the controller - should be overridden by subclasses
     */
    initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }
}