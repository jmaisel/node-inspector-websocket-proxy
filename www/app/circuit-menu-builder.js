/**
 * CircuitMenuBuilder
 * Parses setuplist.txt and builds a hierarchical circuit menu
 */
class CircuitMenuBuilder {
    constructor() {
        this.menuData = null;
        this.logger = new Logger("CircuitMenuBuilder");
    }

    async loadSetupList() {
        try {
            const response = await fetch('/circuitjs1/setuplist.txt');
            const text = await response.text();
            this.menuData = this.parseSetupList(text);
            return this.menuData;
        } catch (err) {
            this.logger.error("Failed to load setuplist.txt:", err);
            throw err;
        }
    }

    parseSetupList(text) {
        const lines = text.split('\n');
        const root = { title: 'Circuits', children: [] };
        const stack = [root];

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;

            if (line.startsWith('+')) {
                // Start submenu
                const submenu = { title: line.substring(1), children: [] };
                stack[stack.length - 1].children.push(submenu);
                stack.push(submenu);
            } else if (line.startsWith('-')) {
                // End submenu
                if (stack.length > 1) {
                    stack.pop();
                }
            } else {
                // Circuit item: "filename.txt Title" or ">filename.txt Title"
                const isDefault = line.startsWith('>');
                const content = isDefault ? line.substring(1) : line;
                const spaceIdx = content.indexOf(' ');

                if (spaceIdx > 0) {
                    const filename = content.substring(0, spaceIdx);
                    const title = content.substring(spaceIdx + 1);
                    stack[stack.length - 1].children.push({
                        type: 'circuit',
                        filename: filename,
                        title: title,
                        isDefault: isDefault
                    });
                }
            }
        }

        return root;
    }

    // Build HTML dropdown menu
    buildDropdownHTML(menuData) {
        let html = '';

        for (const item of menuData.children) {
            if (item.type === 'circuit') {
                html += `<div class="circuit-menu-item" data-filename="${this.escapeHtml(item.filename)}" data-title="${this.escapeHtml(item.title)}">
                    ${this.escapeHtml(item.title)}
                </div>`;
            } else if (item.children) {
                html += this.buildSubmenuHTML(item);
            }
        }

        return html;
    }

    buildSubmenuHTML(item) {
        let html = `<div class="circuit-submenu">
            <div class="circuit-submenu-title">${this.escapeHtml(item.title)} <span class="submenu-arrow">▸</span></div>
            <div class="circuit-submenu-content">`;

        for (const child of item.children) {
            if (child.type === 'circuit') {
                html += `<div class="circuit-menu-item" data-filename="${this.escapeHtml(child.filename)}" data-title="${this.escapeHtml(child.title)}">
                    ${this.escapeHtml(child.title)}
                </div>`;
            } else if (child.children) {
                html += this.buildSubmenuHTML(child);
            }
        }

        html += `</div></div>`;
        return html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global helper to load circuits
window.loadCircuit = function(filename, title) {
    const logger = new Logger("loadCircuit");
    const circuitFrame = document.getElementById('circuitFrame');

    if (!circuitFrame || !circuitFrame.contentWindow) {
        logger.error("Circuit frame not found");
        return;
    }

    const sim = circuitFrame.contentWindow.CircuitJS1;

    if (!sim) {
        logger.error("CircuitJS1 not loaded yet");
        return;
    }

    if (!sim.menuPerformed) {
        logger.error("menuPerformed method not available on CircuitJS1");
        return;
    }

    logger.info("Loading circuit:", filename, title);
    sim.menuPerformed("circuits", "setup " + filename + " " + title);

    // Close dropdown after selection
    const dropdown = document.getElementById('circuits-dropdown-content');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
};

// Global helper to call circuit menu actions
window.callCircuitMenu = function(menu, item) {
    const logger = new Logger("callCircuitMenu");
    const circuitFrame = document.getElementById('circuitFrame');

    if (!circuitFrame || !circuitFrame.contentWindow) {
        logger.error("Circuit frame not found");
        return;
    }

    const sim = circuitFrame.contentWindow.CircuitJS1;

    if (!sim) {
        logger.error("CircuitJS1 not loaded yet");
        return;
    }

    if (!sim.menuPerformed) {
        logger.error("menuPerformed method not available on CircuitJS1");
        return;
    }

    logger.info("Calling menu:", menu, item);
    sim.menuPerformed(menu, item);
};
