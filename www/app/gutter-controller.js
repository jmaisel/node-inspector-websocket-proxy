/**
 * GutterController - Manages the split pane gutter and its controls
 *
 * Handles the interactive gutter between the code and simulator panes,
 * providing controls to maximize either pane or return to split view.
 *
 * @class GutterController
 */
class GutterController {
    /**
     * Creates a new GutterController
     * @param {Object} split - The Split.js instance managing the panes
     * @param {string} gutterSel - CSS selector for the gutter element
     * @param {string} gutterControlsSel - CSS selector for gutter controls (default: "#gutter-buttons")
     */
    constructor(split, gutterSel, gutterControlsSel) {
        this.logger = new Logger('GutterController');

        this.split = split;
        this.gutterSel = gutterSel;
        this.gutterControlsSel = gutterControlsSel || '#gutter-buttons';

        this.bind();
    }

    /**
     * Bind event handlers to gutter and controls
     */
    bind() {
        this.logger.info('.bind()');

        this.gutter = $(this.gutterSel);
        let gutterControls = $(this.gutterControlsSel);

        // Add adjust method to position controls over gutter
        gutterControls.adjust = () => {
            this.logger.debug('gutterControls.adjust');
            let pos = this.gutter.position();
            let left = pos.left - (gutterControls.width() / 2) + (this.gutter.width() / 2);
            gutterControls.css({ top: pos.top + 30, left: left });
            gutterControls.show();
        };
        this.controls = gutterControls;

        // Maximize code pane
        this.maxCode = $('#max-left').click(() => {
            this.logger.info('maxCode');
            if (!this.split.lastPosition)
                this.split.lastPosition = this.split.getSizes();
            this.split.setSizes([100, 0]);
        });

        // Return to split view
        this.returnGutter = $('#return-gutter').click(() => {
            this.logger.info('returnGutter');
            if (this.split.lastPosition)
                this.split.setSizes(this.split.lastPosition);

            this.split.lastPosition = false;
        });

        // Maximize simulator pane
        this.maxSim = $('#max-right').click(() => {
            this.logger.info('maxSim');
            if (!this.split.lastPosition)
                this.split.lastPosition = this.split.getSizes();

            this.split.setSizes([0, 100]);
        });

        // Logo button container (for branding)
        this.logoBtnContainer = $('#logo-btn-container');

        // Track drag state for adjusting control position
        let isDragging = false;
        let isDown = false;

        this.gutter
            .mousedown(() => {
                this.logger.debug('this.gutter.mousedown');
                isDragging = false;
                isDown = true;
            })
            .mousemove(() => {
                this.logger.debug('this.gutter.mousemove');
                isDragging = isDown;
                if (isDragging)
                    this.controls.adjust();
            })
            .mouseup(() => {
                this.logger.debug('this.gutter.mouseup');
                isDragging = false;
                isDown = false;
                this.controls.adjust();
            });
    }
}