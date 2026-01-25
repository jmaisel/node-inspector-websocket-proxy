/**
 * Default template for File Tree component
 *
 * @param {Object} data - Template data
 * @param {string} data.projectFilesLabel - Label for project files section (default: '📁 Project Files')
 * @param {string} data.librariesLabel - Label for libraries section (default: '📚 Libraries')
 * @param {string} data.dependenciesLabel - Label for dependencies section (default: '📦 Dependencies')
 * @param {string} data.devDependenciesLabel - Label for dev dependencies section (default: '🔧 Dev Dependencies')
 * @param {string} data.nodeInternalLabel - Label for node internal section (default: '⚙️ Node Internal')
 * @param {string} instanceId - Unique instance identifier for DOM elements
 * @returns {string} HTML string for the file tree tab pane
 */
export function fileTreeTemplate(data = {}, instanceId = 'files') {
    const {
        projectFilesLabel = '📁 Project Files',
        librariesLabel = '📚 Libraries',
        dependenciesLabel = '📦 Dependencies',
        devDependenciesLabel = '🔧 Dev Dependencies',
        nodeInternalLabel = '⚙️ Node Internal'
    } = data;

    return `
        <div class="tab-pane" id="tab-${instanceId}">
            <div id="fileTree">
                <div class="tree-node">
                    <div class="tree-node-header" >
                        <span class="tree-icon">▶</span>
                        <span class="tree-label">${projectFilesLabel}</span>
                    </div>
                    <div class="tree-children" id="projectFiles"></div>
                </div>
                <div class="tree-node">
                    <div class="tree-node-header" >
                        <span class="tree-icon">▶</span>
                        <span class="tree-label">${librariesLabel}</span>
                    </div>
                    <div class="tree-children">
                        <div class="tree-node">
                            <div class="tree-node-header" >
                                <span class="tree-icon">▶</span>
                                <span class="tree-label">${dependenciesLabel}</span>
                            </div>
                            <div class="tree-children" id="dependencies"></div>
                        </div>
                        <div class="tree-node">
                            <div class="tree-node-header" >
                                <span class="tree-icon">▶</span>
                                <span class="tree-label">${devDependenciesLabel}</span>
                            </div>
                            <div class="tree-children" id="devDependencies"></div>
                        </div>
                    </div>
                </div>
                <div class="tree-node">
                    <div class="tree-node-header" >
                        <span class="tree-icon">▶</span>
                        <span class="tree-label">${nodeInternalLabel}</span>
                    </div>
                    <div class="tree-children" id="nodeInternalFiles"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Template for a single file item in the tree
 *
 * @param {Object} fileData - File data
 * @param {string} fileData.scriptId - Script ID
 * @param {string} fileData.url - Full URL of the file
 * @param {string} fileData.fileName - File name
 * @returns {string} HTML string for a single file item
 */
export function fileItemTemplate(fileData) {
    const { scriptId, url, fileName } = fileData;

    return `
        <div class="tree-file" data-script-id="${scriptId}" data-url="${url}" title="${url}">
            <span class="tree-file-icon">📄</span>
            <span class="tree-file-name">${fileName}</span>
            <button class="tree-file-bp-btn" data-url="${url}" title="Set breakpoint in this file">🔴</button>
        </div>
    `;
}