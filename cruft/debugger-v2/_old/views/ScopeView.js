import { BaseView } from '../core/BaseView.js';
import { scopeTemplate } from '../templates/scope-template.js';

export class ScopeView extends BaseView {
    constructor(config = {}) {
        super(config);
        if (!this.state.scopes) this.state.scopes = [];
    }

    defineElementMap() {
        return {
            container: '',
            scopesContainer: '-scopes'
        };
    }

    getDefaultTemplate() {
        return scopeTemplate;
    }

    renderScope(scopes) {
        this.setState({ scopes });
        this.update();
    }

    clearScope() {
        this.setState({ scopes: [] });
        this.update();
    }
}
