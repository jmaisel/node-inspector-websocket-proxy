import { BreakpointListView } from '../views/BreakpointListView.js';

export class BreakpointController {
    constructor(config = {}) {
        this.view = new BreakpointListView({ container: config.container });
        this.eventHandlers = {
            add: [],
            remove: [],
            toggle: []
        };
    }

    async initialize() {
        await this.view.mount();
        this.view.getElement().on('breakpoint-add', (e, data) => this.notifyHandlers('add', data));
        this.view.getElement().on('breakpoint-remove', (e, data) => this.notifyHandlers('remove', data));
        this.view.getElement().on('breakpoint-toggle', (e, data) => this.notifyHandlers('toggle', data));
    }

    on(event, handler) {
        if (this.eventHandlers[event]) this.eventHandlers[event].push(handler);
    }

    notifyHandlers(event, data) {
        (this.eventHandlers[event] || []).forEach(h => h(data));
    }

    addBreakpoint(bp) { this.view.addBreakpoint(bp); }
    removeBreakpoint(id) { this.view.removeBreakpoint(id); }
    updateBreakpoint(id, updates) { this.view.updateBreakpoint(id, updates); }
    getView() { return this.view; }
    destroy() { this.view.unmount(); }
}
