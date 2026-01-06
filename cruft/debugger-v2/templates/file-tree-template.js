import { escapeHtml } from '../core/ViewUtils.js';

/**
 * Template for FileTreeView
 */
export function fileTreeTemplate(data, config, instanceId) {
    const { projectFiles = [], dependencies = [], devDependencies = [], nodeInternalFiles = [] } = data;

    const renderFiles = (files) => files.map(file => `
        <div class="tree-file" data-script-id="${file.scriptId}" data-url="${escapeHtml(file.url)}">
            <span class="tree-file-icon">📄</span>
            <span class="tree-file-name">${escapeHtml(file.fileName)}</span>
            <button class="tree-file-bp-btn" data-url="${escapeHtml(file.url)}" title="Set breakpoint">🔴</button>
        </div>
    `.trim()).join('\n                ');

    return `
        <div id="${instanceId}" class="file-tree-container">
            <div class="tree-node">
                <div class="tree-node-header">
                    <span class="tree-icon">▶</span>
                    <span class="tree-label">📁 Project Files</span>
                </div>
                <div class="tree-children" id="${instanceId}-project-files">
                    ${renderFiles(projectFiles)}
                </div>
            </div>
            <div class="tree-node">
                <div class="tree-node-header">
                    <span class="tree-icon">▶</span>
                    <span class="tree-label">📚 Libraries</span>
                </div>
                <div class="tree-children">
                    <div class="tree-node">
                        <div class="tree-node-header">
                            <span class="tree-icon">▶</span>
                            <span class="tree-label">📦 Dependencies</span>
                        </div>
                        <div class="tree-children" id="${instanceId}-dependencies">
                            ${renderFiles(dependencies)}
                        </div>
                    </div>
                    <div class="tree-node">
                        <div class="tree-node-header">
                            <span class="tree-icon">▶</span>
                            <span class="tree-label">🔧 Dev Dependencies</span>
                        </div>
                        <div class="tree-children" id="${instanceId}-dev-dependencies">
                            ${renderFiles(devDependencies)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="tree-node">
                <div class="tree-node-header">
                    <span class="tree-icon">▶</span>
                    <span class="tree-label">⚙️ Node Internal</span>
                </div>
                <div class="tree-children" id="${instanceId}-node-internal">
                    ${renderFiles(nodeInternalFiles)}
                </div>
            </div>
        </div>
    `.trim();
}
