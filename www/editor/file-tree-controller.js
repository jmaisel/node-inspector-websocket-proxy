/**
 * FileTreeController - Manages file tree panel interactions
 *
 * Handles file tree toggle, search/filtering, and coordinates with
 * the Ace editor for proper resizing during UI transitions.
 *
 * @class FileTreeController
 */
class FileTreeController {
    /**
     * Creates a new FileTreeController
     */
    constructor() {
        this.logger = new Logger('FileTreeController');
        this.panel = null;
        this.container = null;
        this.searchInput = null;
        this.clearBtn = null;
    }

    /**
     * Set the application context
     * @param {Object} ctx - The application context
     */
    setCtx(ctx) {
        this.logger.info('setCtx', ctx);
        this.application = ctx;
    }

    /**
     * Initialize the file tree controller
     */
    initialize() {
        this.logger.info('Initializing FileTreeController');
        this.bind();
    }

    /**
     * Bind event handlers for file tree interactions
     */
    bind() {
        this.logger.info('Binding file tree event handlers');

        // Cache jQuery elements
        this.panel = $('#file-tree-panel');
        this.container = $('#code-editor-container');
        this.searchInput = $('#file-tree-search');
        this.clearBtn = $('#clear-file-search');

        // Bind toggle button (using event delegation since rendered dynamically)
        $(document).on('click', '#toggle-filetree', () => this.toggleFileTree());

        // Bind search input
        this.searchInput.on('input', (e) => this.handleSearch(e));

        // Bind clear button
        this.clearBtn.on('click', () => this.clearSearch());
    }

    /**
     * Toggle file tree panel visibility
     */
    toggleFileTree() {
        this.logger.info('Toggling file tree panel');

        // Toggle classes on both elements for synchronized animation
        this.panel.toggleClass('collapsed');
        this.container.toggleClass('panel-collapsed');

        // Use transitionend event to know exactly when animation completes
        this.panel.one('transitionend', () => {
            this.resizeAceEditor();
        });

        // Fallback timeout in case transitionend doesn't fire
        setTimeout(() => this.resizeAceEditor(), 400);
    }

    /**
     * Handle file tree search input
     * @param {Event} e - The input event
     */
    handleSearch(e) {
        const searchTerm = $(e.target).val().toLowerCase();

        // Show/hide clear button
        if (searchTerm) {
            this.clearBtn.addClass('visible');
        } else {
            this.clearBtn.removeClass('visible');
        }

        // Filter file tree items
        $('#file-tree .file-tree-item, #file-tree .tree-file').each(function() {
            const fileName = $(this).text().toLowerCase();
            if (fileName.includes(searchTerm)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        // Handle tree nodes - show parent nodes if any child matches
        $('#file-tree .tree-node').each(function() {
            const $node = $(this);
            const $children = $node.find('.tree-file:visible, .file-tree-item:visible');
            if ($children.length > 0 || searchTerm === '') {
                $node.show();
            } else {
                $node.hide();
            }
        });
    }

    /**
     * Clear the search input and reset filter
     */
    clearSearch() {
        this.logger.info('Clearing file tree search');
        this.searchInput.val('').trigger('input');
        this.searchInput.focus();
    }

    /**
     * Resize Ace editor to fit container
     * Called after file tree animations complete
     */
    resizeAceEditor() {
        const codeFrame = document.getElementById('code');
        if (codeFrame && codeFrame.contentWindow) {
            try {
                // Try multiple methods to trigger resize
                if (codeFrame.contentWindow.editor && typeof codeFrame.contentWindow.editor.resize === 'function') {
                    codeFrame.contentWindow.editor.resize();
                    this.logger.log('Ace editor resized directly');
                }
            } catch (e) {
                this.logger.log('Could not resize ace editor:', e);
            }
        }
    }
}
