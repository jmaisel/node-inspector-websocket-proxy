import { BaseView } from '../core/BaseView.js';
import { callstackTemplate } from '../templates/callstack-template.js';

export class CallStackView extends BaseView {
    constructor(config = {}) {
        super(config);
        if (!this.state.callFrames) this.state.callFrames = [];
    }

    defineElementMap() {
        return {
            container: '',
            frameList: '-frame-list'
        };
    }

    getDefaultTemplate() {
        return callstackTemplate;
    }

    async attachEvents() {
        this.$element.on('click', '.list-item', (e) => {
            const index = $(e.currentTarget).data('frame-index');
            this.selectFrame(index);
        });
    }

    renderCallStack(callFrames) {
        this.setState({ callFrames });
        this.update();
    }

    selectFrame(index) {
        const frames = this.state.callFrames.map((f, i) => ({
            ...f,
            selected: i === index
        }));
        this.setState({ callFrames: frames });
        this.update();

        if (this.$element) {
            this.$element.trigger('frame-selected', { index, frame: frames[index] });
        }
    }

    clearCallStack() {
        this.setState({ callFrames: [] });
        this.update();
    }
}
