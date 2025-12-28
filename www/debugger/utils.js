// =============================================================================
// DOM UTILITIES
// =============================================================================

/**
 * Check if an element is scrolled to the bottom (within 5px threshold)
 * @param {HTMLElement} element - The scrollable element to check
 * @returns {boolean} True if scrolled to bottom
 */
function isScrolledToBottom(element) {
    return element.scrollHeight - element.scrollTop <= element.clientHeight + 5; // 5px threshold
}

// =============================================================================
// URL UTILITIES
// =============================================================================

/**
 * Extract filename or package name from a URL
 * @param {string} url - The URL to parse
 * @returns {string} The extracted filename or package name
 */
function getFileName(url) {
    if (!url) return 'unknown';

    // Handle node: protocol
    if (url.startsWith('node:')) {
        return url;
    }

    // Handle file:// URLs
    if (url.startsWith('file://')) {
        const path = url.replace('file://', '');
        const parts = path.split('/');
        return parts[parts.length - 1] || path;
    }

    // For node_modules, show package/file
    if (url.includes('node_modules')) {
        const parts = url.split('node_modules/');
        if (parts.length > 1) {
            const libPath = parts[1];
            const pathParts = libPath.split('/');
            if (pathParts[0].startsWith('@')) {
                // Scoped package
                return `${pathParts[0]}/${pathParts[1]}`;
            }
            return pathParts[0];
        }
    }

    return url;
}

/**
 * Format a file path for display (shortened for UI)
 * @param {string} url - The URL to format
 * @returns {string} The formatted file path
 */
function formatFilePath(url) {
    if (!url || url === 'unknown') return 'unknown';

    // Remove file:// protocol
    let path = url.replace('file://', '');

    // Get just the filename for node_modules
    if (path.includes('node_modules')) {
        const parts = path.split('node_modules/');
        if (parts.length > 1) {
            return 'node_modules/' + parts[1].split('/').slice(0, 2).join('/');
        }
    }

    // For regular files, show the last 2-3 path segments
    const segments = path.split('/').filter(s => s);
    if (segments.length > 3) {
        return '.../' + segments.slice(-3).join('/');
    }

    return path;
}

// =============================================================================
// CODE HIGHLIGHTING UTILITIES
// =============================================================================

/**
 * Simple syntax highlighter for JavaScript code
 * @param {string} code - The code to highlight
 * @param {string} language - The language (default: 'javascript')
 * @returns {string} HTML string with syntax highlighting spans
 */
function highlightCode(code, language = 'javascript') {
    if (!code) return '';

    // Escape HTML first
    code = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    if (language === 'javascript' || language === 'js') {
        // Keywords
        code = code.replace(/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|class|extends|import|export|from|default|async|await|yield|typeof|instanceof|void|delete|in|of|this|super|static|get|set|null|undefined|true|false)\b/g, '<span class="hl-keyword">$1</span>');

        // Strings
        code = code.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span class="hl-string">$1</span>');

        // Numbers
        code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');

        // Comments
        code = code.replace(/(\/\/.*$)/gm, '<span class="hl-comment">$1</span>');
        code = code.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');

        // Functions (simple pattern)
        code = code.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, '<span class="hl-function">$1</span>(');
    }

    return code;
}