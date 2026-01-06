import { FileTreeView } from '../views/FileTreeView.js';

export class FileTreeController {
    constructor(config = {}) {
        this.view = new FileTreeView({ container: config.container });
        this.onFileSelected = config.onFileSelected || null;
    }

    async initialize() {
        await this.view.mount();
        this.view.getElement().on('file-selected', (e, data) => {
            if (this.onFileSelected) this.onFileSelected(data.scriptId, data.url);
        });
    }

    addScript(scriptId, url, category) {
        this.view.addScript(scriptId, url, category);
    }

    getView() { return this.view; }
    destroy() { this.view.unmount(); }
}
