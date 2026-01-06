import { ScopeView } from '../views/ScopeView.js';

export class ScopeController {
    constructor(config = {}) {
        this.view = new ScopeView({ container: config.container });
    }

    async initialize() {
        await this.view.mount();
    }

    renderScope(scopes) { this.view.renderScope(scopes); }
    clearScope() { this.view.clearScope(); }
    getView() { return this.view; }
    destroy() { this.view.unmount(); }
}
