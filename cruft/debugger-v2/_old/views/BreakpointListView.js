import { BaseView } from '../core/BaseView.js';
import { breakpointListTemplate } from '../templates/breakpoint-list-template.js';

export class BreakpointListView extends BaseView {
    constructor(config = {}) {
        super(config);
        if (!this.state.breakpoints) this.state.breakpoints = [];
    }

    defineElementMap() {
        return {
            container: '',
            list: '-list',
            urlInput: '-url-input',
            lineInput: '-line-input',
            addBtn: '-add-btn'
        };
    }

    getDefaultTemplate() {
        return breakpointListTemplate;
    }

    async attachEvents() {
        const elements = this.getElementMap();

        // Add breakpoint
        $(elements.addBtn).on('click', () => this.handleAdd());
        $(elements.urlInput).on('keypress', (e) => {
            if (e.which === 13) this.handleAdd();
        });
        $(elements.lineInput).on('keypress', (e) => {
            if (e.which === 13) this.handleAdd();
        });

        // Toggle breakpoint
        this.$element.on('change', '.bp-toggle', (e) => {
            const id = $(e.currentTarget).data('breakpoint-id');
            this.handleToggle(id);
        });

        // Remove breakpoint
        this.$element.on('click', '.bp-remove-btn', (e) => {
            const id = $(e.currentTarget).data('breakpoint-id');
            this.handleRemove(id);
        });
    }

    handleAdd() {
        const elements = this.getElementMap();
        const url = $(elements.urlInput).val();
        const lineNumber = parseInt($(elements.lineInput).val());

        if (url && lineNumber) {
            this.$element.trigger('breakpoint-add', { url, lineNumber });
            $(elements.urlInput).val('');
            $(elements.lineInput).val('');
        }
    }

    handleToggle(id) {
        this.$element.trigger('breakpoint-toggle', { id });
    }

    handleRemove(id) {
        this.$element.trigger('breakpoint-remove', { id });
    }

    addBreakpoint(bp) {
        this.state.breakpoints.push(bp);
        this.update();
    }

    removeBreakpoint(id) {
        this.state.breakpoints = this.state.breakpoints.filter(bp => bp.id !== id);
        this.update();
    }

    updateBreakpoint(id, updates) {
        this.state.breakpoints = this.state.breakpoints.map(bp =>
            bp.id === id ? { ...bp, ...updates } : bp
        );
        this.update();
    }
}
