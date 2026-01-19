/**
 * ToolbarHelper - Handles toolbar detachment and reattachment
 */
class ToolbarHelper {
    constructor(aceController) {
        this.ace = aceController;
        this.logger = new Logger('ToolbarHelper');
    }

    detachToolbar() {
        if (this.ace.isToolbarDetached) {
            this.reattachToolbar();
            return;
        }

        this.logger.info('Detaching toolbar');

        // Get toolbar
        const toolbar = $('#code-toolbar').detach();

        // Create floating window
        this.ace.detachedToolbar = $('<div></div>')
            .addClass('draggable-window toolbar-window')
            .css({
                width: '600px',
                height: 'auto',
                top: '80px',
                left: '100px'
            });

        // Add header with close button
        const header = $('<div></div>')
            .addClass('draggable-header')
            .html('Debug Toolbar <span class="close-btn" id="toolbar-reattach-btn">×</span>');

        // Add content area
        const content = $('<div></div>')
            .addClass('draggable-content toolbar-detached-content')
            .append(toolbar);

        this.ace.detachedToolbar.append(header).append(content);

        // Make draggable
        this.ace.detachedToolbar.draggable({ handle: '.draggable-header' });

        // Append to body
        $('body').append(this.ace.detachedToolbar);

        // Show placeholder in original location
        $('#tabs-1').prepend(
            '<div id="toolbar-placeholder" style="height: 60px; background-color: #222; border-bottom: 1px solid #555; display: flex; align-items: center; justify-content: center; color: #777; font-style: italic;">' +
            'Toolbar detached. <a href="#" id="toolbar-reattach-link" style="color: #0099ff; text-decoration: none; margin-left: 5px;">Reattach</a>' +
            '</div>'
        );

        // Bind reattach handlers
        $('#toolbar-reattach-btn, #toolbar-reattach-link').on('click', (e) => {
            e.preventDefault();
            this.reattachToolbar();
        });

        this.ace.isToolbarDetached = true;

        this.logger.info('Toolbar detached');
    }

    reattachToolbar() {
        if (!this.ace.isToolbarDetached) return;

        this.logger.info('Reattaching toolbar');

        // Get toolbar from floating window
        const toolbar = this.ace.detachedToolbar.find('#code-toolbar').detach();

        // Remove placeholder
        $('#toolbar-placeholder').remove();

        // Reattach to original location
        $('#tabs-1').prepend(toolbar);

        // Remove floating window
        this.ace.detachedToolbar.remove();
        this.ace.detachedToolbar = null;

        this.ace.isToolbarDetached = false;

        this.logger.info('Toolbar reattached');
    }
}
