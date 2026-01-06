import { WatchesView } from '../views/WatchesView.js';

export class WatchesController {
    constructor(config = {}) {
        this.view = new WatchesView({ container: config.container });
        this.eventHandlers = { add: [], remove: [] };
    }

    async initialize() {
        await this.view.mount();
        this.view.getElement().on('watch-add', (e, data) => this.notifyHandlers('add', data));
        this.view.getElement().on('watch-remove', (e, data) => this.notifyHandlers('remove', data));
    }

    on(event, handler) {
        if (this.eventHandlers[event]) this.eventHandlers[event].push(handler);
    }

    notifyHandlers(event, data) {
        (this.eventHandlers[event] || []).forEach(h => h(data));
    }

    addWatch(watch) { this.view.addWatch(watch); }
    removeWatch(id) { this.view.removeWatch(id); }
    updateWatch(id, updates) { this.view.updateWatch(id, updates); }
    getView() { return this.view; }
    destroy() { this.view.unmount(); }
}
