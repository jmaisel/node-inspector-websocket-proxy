import { BaseView } from '../core/BaseView.js';
import { fileTreeTemplate } from '../templates/file-tree-template.js';

export class FileTreeView extends BaseView {
    constructor(config = {}) {
        super(config);
        if (!this.state.projectFiles) this.state.projectFiles = [];
        if (!this.state.dependencies) this.state.dependencies = [];
        if (!this.state.devDependencies) this.state.devDependencies = [];
        if (!this.state.nodeInternalFiles) this.state.nodeInternalFiles = [];
    }

    defineElementMap() {
        return {
            container: '',
            projectFilesContainer: '-project-files',
            dependenciesContainer: '-dependencies',
            devDependenciesContainer: '-dev-dependencies',
            nodeInternalContainer: '-node-internal'
        };
    }

    getDefaultTemplate() {
        return fileTreeTemplate;
    }

    async attachEvents() {
        // Tree node expansion
        this.$element.on('click', '.tree-node-header', function() {
            const $node = $(this).closest('.tree-node');
            $node.toggleClass('expanded');
        });

        // File selection
        this.$element.on('click', '.tree-file', (e) => {
            if (!$(e.target).hasClass('tree-file-bp-btn')) {
                const scriptId = $(e.currentTarget).data('script-id');
                const url = $(e.currentTarget).data('url');
                this.onFileSelected(scriptId, url);
            }
        });
    }

    addScript(scriptId, url, category = 'projectFiles') {
        const fileName = url.split('/').pop() || url;
        const file = { scriptId, url, fileName };
        this.state[category].push(file);
        this.update();
    }

    onFileSelected(scriptId, url) {
        if (this.$element) {
            this.$element.trigger('file-selected', { scriptId, url });
        }
    }
}
