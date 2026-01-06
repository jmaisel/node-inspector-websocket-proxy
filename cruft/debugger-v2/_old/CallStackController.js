import { CallStackView } from '../views/CallStackView.js';

export class CallStackController {
    constructor(config = {}) {
        this.view = new CallStackView({ container: config.container });
        this.onFrameSelected = config.onFrameSelected || null;
    }

    async initialize() {
        await this.view.mount();
        this.view.getElement().on('frame-selected', (e, data) => {
            if (this.onFrameSelected) this.onFrameSelected(data.index, data.frame);
        });
    }

    renderCallStack(callFrames) { this.view.renderCallStack(callFrames); }
    clearCallStack() { this.view.clearCallStack(); }
    getView() { return this.view; }
    destroy() { this.view.unmount(); }
}
