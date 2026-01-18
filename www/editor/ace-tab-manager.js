/**
 * AceTabManager - Manages the tab bar UI for open editor files
 */
class AceTabManager {
    constructor(aceController, editorHelper) {
        this.aceController = aceController;
        this.editorHelper = editorHelper;
        this.tabContainer = document.getElementById('editor-tabs');
        this.logger = new Logger("AceTabManager");

        if (!this.tabContainer) {
            this.logger.error("Tab container #editor-tabs not found!");
        } else {
            this.logger.info("AceTabManager initialized");
        }
    }

    /**
     * Create a new tab for a file
     * @param {string} filePath - Full path to the file
     * @param {string} fileName - Display name for the file
     */
    createTab(filePath, fileName) {
        // Don't create duplicate tabs
        if (this.tabContainer.querySelector(`[data-filepath="${filePath}"]`)) {
            this.setActiveTab(filePath);
            return;
        }

        const tab = document.createElement('div');
        tab.className = 'editor-tab';
        tab.dataset.filepath = filePath;
        tab.title = filePath; // Show full path on hover

        const label = document.createElement('span');
        label.className = 'editor-tab-label';
        label.textContent = fileName;

        const closeBtn = document.createElement('span');
        closeBtn.className = 'editor-tab-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.closeTab(filePath);
        };

        tab.appendChild(label);
        tab.appendChild(closeBtn);
        tab.onclick = () => this.switchToTab(filePath);

        this.tabContainer.appendChild(tab);
        this.setActiveTab(filePath);

        this.logger.info("Created tab for:", filePath);
    }

    /**
     * Set the active tab
     * @param {string} filePath - Full path to the file
     */
    setActiveTab(filePath) {
        // Remove active class from all tabs
        this.tabContainer.querySelectorAll('.editor-tab').forEach(t => {
            t.classList.remove('active');
        });

        // Add active class to this tab
        const tab = this.tabContainer.querySelector(`[data-filepath="${filePath}"]`);
        if (tab) {
            tab.classList.add('active');
            // Ensure tab is visible by scrolling it into view
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }

    /**
     * Switch to a tab (calls editor to switch session)
     * @param {string} filePath - Full path to the file
     */
    switchToTab(filePath) {
        this.logger.info("Switching to tab:", filePath);
        // Editor helper will switch the session and call setActiveTab
        this.editorHelper.switchToFile(filePath);
    }

    /**
     * Close a tab
     * @param {string} filePath - Full path to the file
     */
    closeTab(filePath) {
        this.logger.info("Closing tab:", filePath);
        // Editor helper will handle dirty check and call removeTab if successful
        this.editorHelper.closeFile(filePath);
    }

    /**
     * Remove a tab from the UI
     * @param {string} filePath - Full path to the file
     */
    removeTab(filePath) {
        const tab = this.tabContainer.querySelector(`[data-filepath="${filePath}"]`);
        if (tab) {
            tab.remove();
            this.logger.info("Removed tab:", filePath);
        }

        // Switch to another tab if available
        const remainingTabs = this.tabContainer.querySelectorAll('.editor-tab');
        if (remainingTabs.length > 0) {
            const nextFilePath = remainingTabs[0].dataset.filepath;
            this.switchToTab(nextFilePath);
        }
    }

    /**
     * Mark a tab as dirty (has unsaved changes)
     * @param {string} filePath - Full path to the file
     */
    markTabDirty(filePath) {
        const tab = this.tabContainer.querySelector(`[data-filepath="${filePath}"]`);
        if (tab && !tab.classList.contains('dirty')) {
            tab.classList.add('dirty');
            const label = tab.querySelector('.editor-tab-label');
            if (!label.textContent.startsWith('• ')) {
                label.textContent = '• ' + label.textContent;
            }
            this.logger.debug("Marked tab as dirty:", filePath);
        }
    }

    /**
     * Mark a tab as clean (saved)
     * @param {string} filePath - Full path to the file
     */
    markTabClean(filePath) {
        const tab = this.tabContainer.querySelector(`[data-filepath="${filePath}"]`);
        if (tab && tab.classList.contains('dirty')) {
            tab.classList.remove('dirty');
            const label = tab.querySelector('.editor-tab-label');
            label.textContent = label.textContent.replace('• ', '');
            this.logger.debug("Marked tab as clean:", filePath);
        }
    }
}