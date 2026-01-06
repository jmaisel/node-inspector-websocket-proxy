import { BaseView } from '../core/BaseView.js';
import { watchesTemplate } from '../templates/watches-template.js';

export class WatchesView extends BaseView {
    constructor(config = {}) {
        super(config);
        if (!this.state.watches) this.state.watches = [];
    }

    defineElementMap() {
        return {
            container: '',
            list: '-list',
            expressionInput: '-expression-input',
            addBtn: '-add-btn'
        };
    }

    getDefaultTemplate() {
        return watchesTemplate;
    }

    async attachEvents() {
        const elements = this.getElementMap();

        $(elements.addBtn).on('click', () => this.handleAdd());
        $(elements.expressionInput).on('keypress', (e) => {
            if (e.which === 13) this.handleAdd();
        });

        this.$element.on('click', '.watch-remove-btn', (e) => {
            const id = $(e.currentTarget).data('watch-id');
            this.handleRemove(id);
        });
    }

    handleAdd() {
        const elements = this.getElementMap();
        const expression = $(elements.expressionInput).val();

        if (expression) {
            this.$element.trigger('watch-add', { expression });
            $(elements.expressionInput).val('');
        }
    }

    handleRemove(id) {
        this.$element.trigger('watch-remove', { id });
    }

    addWatch(watch) {
        this.state.watches.push(watch);
        this.update();
    }

    removeWatch(id) {
        this.state.watches = this.state.watches.filter(w => w.id !== id);
        this.update();
    }

    updateWatch(id, updates) {
        this.state.watches = this.state.watches.map(w =>
            w.id === id ? { ...w, ...updates } : w
        );
        this.update();
    }
}
