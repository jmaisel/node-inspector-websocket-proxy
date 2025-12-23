let client = null;
let isPaused = false;
let watches = [];
let breakpoints = [];
let currentCallFrames = [];
let scriptMap = new Map(); // scriptId -> url mapping
let packageDependencies = new Set();
let packageDevDependencies = new Set();

// Toolbar icon size configuration
function setIconSize(size) {
    $('#toolbar').attr('data-icon-size', size);
    localStorage.setItem('debugger-icon-size', size);
    $('#settingsPanel').hide();
}

// Icon size button handlers
$('#iconSizeSmall').click(() => setIconSize('small'));
$('#iconSizeMedium').click(() => setIconSize('medium'));
$('#iconSizeLarge').click(() => setIconSize('large'));

// Settings panel toggle
$('#settingsBtn').click(function(e) {
    e.stopPropagation();
    const $panel = $('#settingsPanel');
    const $btn = $(this);

    if ($panel.is(':visible')) {
        $panel.hide();
    } else {
        // Position panel near the settings button
        const btnOffset = $btn.offset();
        const btnHeight = $btn.outerHeight();
        $panel.css({
            top: btnOffset.top + btnHeight + 5,
            left: btnOffset.left
        });
        $panel.show();
    }
});

// Close settings panel when clicking outside
$(document).click(function(e) {
    if (!$(e.target).closest('#settingsPanel, #settingsBtn').length) {
        $('#settingsPanel').hide();
    }
});

// Toolbar docking functions
function dockToolbarToZone() {
    const $toolbar = $('#toolbar');
    const $zone = $('#toolbarDockZone');

    // Disable draggable
    if ($toolbar.data('ui-draggable')) {
        $toolbar.draggable('destroy');
    }

    // Move toolbar to docking zone
    $toolbar.addClass('docked-to-zone');
    $toolbar.css({ top: '', left: '', position: '' });
    $zone.append($toolbar);
    $zone.addClass('has-toolbar');

    // Hide redock button when docked
    $('#toolbarRedockBtn').hide();

    // Save docked state
    localStorage.setItem('debugger-toolbar-docked', 'true');
    localStorage.removeItem('debugger-toolbar-pos');

    // Re-enable draggable with updated behavior
    $toolbar.draggable({
        handle: '#toolbarGrip',
        start: function() {
            // Undock on drag start
            undockToolbarFromZone();
        }
    });
}

function undockToolbarFromZone() {
    const $toolbar = $('#toolbar');
    const $zone = $('#toolbarDockZone');

    // Remove from zone
    $toolbar.removeClass('docked-to-zone');
    $zone.removeClass('has-toolbar');
    $('body').append($toolbar);

    // Make floating
    $toolbar.css({
        position: 'absolute',
        top: 40,
        left: 0
    });

    // Show redock button when floating
    $('#toolbarRedockBtn').show();

    // Save undocked state
    localStorage.setItem('debugger-toolbar-docked', 'false');

    // Re-enable draggable
    if ($toolbar.data('ui-draggable')) {
        $toolbar.draggable('destroy');
    }

    $toolbar.draggable({
        handle: '#toolbarGrip',
        containment: 'window',
        stop: function(event, ui) {
            // Check if near docking zone
            const zoneOffset = $('#toolbarDockZone').offset();
            const zoneHeight = 50; // Detection zone

            if (ui.offset.top < zoneOffset.top + zoneHeight &&
                ui.offset.top > zoneOffset.top - zoneHeight) {
                // Snap to docking zone
                dockToolbarToZone();
            } else {
                // Save floating position
                localStorage.setItem('debugger-toolbar-pos', JSON.stringify({
                    top: ui.position.top,
                    left: ui.position.left
                }));
            }
        }
    });
}

// Initialize toolbar on document ready
$(document).ready(function() {
    // Restore icon size
    const savedSize = localStorage.getItem('debugger-icon-size') || 'medium';
    setIconSize(savedSize);

    // Check if toolbar should be docked
    const isDocked = localStorage.getItem('debugger-toolbar-docked');

    if (isDocked === 'true') {
        // Dock to zone
        dockToolbarToZone();
    } else {
        // Show redock button for floating toolbar
        $('#toolbarRedockBtn').show();

        // Restore floating position or use default
        const savedPos = localStorage.getItem('debugger-toolbar-pos');
        if (savedPos) {
            const pos = JSON.parse(savedPos);
            $('#toolbar').css({ top: pos.top, left: pos.left });
        }

        // Make toolbar draggable
        $('#toolbar').draggable({
            handle: '#toolbarGrip',
            containment: 'window',
            stop: function(event, ui) {
                // Check if near docking zone
                const zoneOffset = $('#toolbarDockZone').offset();
                const zoneHeight = 50; // Detection zone

                if (ui.offset.top < zoneOffset.top + zoneHeight &&
                    ui.offset.top > zoneOffset.top - zoneHeight) {
                    // Snap to docking zone
                    dockToolbarToZone();
                } else {
                    // Save floating position
                    localStorage.setItem('debugger-toolbar-pos', JSON.stringify({
                        top: ui.position.top,
                        left: ui.position.left
                    }));
                }
            }
        });
    }
});

// Tab switching
$('.tab-btn').click(function() {
    const tab = $(this).data('tab');

    // Update active tab button
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');

    // Update active tab pane
    $('.tab-pane').removeClass('active');
    $('#tab-' + tab).addClass('active');
});

// Tree node toggle
function toggleTreeNode(header) {
    $(header).parent('.tree-node').toggleClass('expanded');
}

// Load package.json to categorize dependencies
async function loadPackageJson() {
    try {
        // Try to fetch package.json from parent directory
        const response = await fetch('../package.json');
        if (response.ok) {
            const pkg = await response.json();

            // Store dependencies
            if (pkg.dependencies) {
                Object.keys(pkg.dependencies).forEach(dep => {
                    packageDependencies.add(dep);
                });
            }

            // Store devDependencies
            if (pkg.devDependencies) {
                Object.keys(pkg.devDependencies).forEach(dep => {
                    packageDevDependencies.add(dep);
                });
            }

            log(`Loaded package.json: ${packageDependencies.size} dependencies, ${packageDevDependencies.size} devDependencies`, 'info');
        }
    } catch (error) {
        console.warn('Could not load package.json:', error);
    }
}

// Call on page load
$(document).ready(function() {
    loadPackageJson();
});

// File tree management
function categorizeScript(url) {
    if (!url) return 'node-internal';

    // Node internal modules
    if (url.startsWith('node:') || url.startsWith('internal/') || url === 'evalmachine.<anonymous>') {
        return 'node-internal';
    }

    // Libraries (node_modules)
    if (url.includes('node_modules')) {
        // Extract package name
        const parts = url.split('node_modules/');
        if (parts.length > 1) {
            const libPath = parts[1];
            const pathParts = libPath.split('/');
            let packageName;

            if (pathParts[0].startsWith('@')) {
                // Scoped package
                packageName = `${pathParts[0]}/${pathParts[1]}`;
            } else {
                packageName = pathParts[0];
            }

            // Check if it's a dependency or devDependency
            if (packageDependencies.has(packageName)) {
                return 'dependency';
            } else if (packageDevDependencies.has(packageName)) {
                return 'devDependency';
            }
        }
        // Default to dependency if not found
        return 'dependency';
    }

    // Project files
    return 'project';
}

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

function addScriptToFileTree(scriptId, url) {
    const category = categorizeScript(url);
    const fileName = getFileName(url);

    let containerId;
    if (category === 'project') {
        containerId = '#projectFiles';
    } else if (category === 'dependency') {
        containerId = '#dependencies';
    } else if (category === 'devDependency') {
        containerId = '#devDependencies';
    } else {
        containerId = '#nodeInternalFiles';
    }

    // Check if already added
    if ($(`${containerId} [data-script-id="${scriptId}"]`).length > 0) {
        return;
    }

    const fileHtml = `
        <div class="tree-file" data-script-id="${scriptId}" data-url="${url}" title="${url}">
            <span class="tree-file-icon">📄</span>
            <span class="tree-file-name">${fileName}</span>
        </div>
    `;

    $(containerId).append(fileHtml);
}

// Handle file selection
$(document).on('click', '.tree-file', function() {
    $('.tree-file').removeClass('active');
    $(this).addClass('active');

    const scriptId = $(this).data('script-id');
    const url = $(this).data('url');

    log(`Selected file: ${url} (scriptId: ${scriptId})`, 'info');
    // TODO: Load and display source code
});

// Console auto-scroll tracking
let consoleAutoScroll = true;
let consoleDockAutoScroll = true;

// Check if scrolled to bottom
function isScrolledToBottom(element) {
    return element.scrollHeight - element.scrollTop <= element.clientHeight + 5; // 5px threshold
}

// Logging
function log(message, type = 'info') {
    // Remove empty state if exists
    $('#debugLog .empty-state').remove();
    $('#debugLogDock .empty-state').remove();

    const timestamp = new Date().toLocaleTimeString();
    const logHtml = `<div class="log-entry ${type}">[${timestamp}] ${message}</div>`;

    // Add to both console views
    $('#debugLog').append(logHtml);
    $('#debugLogDock').append(logHtml);

    // Auto-scroll if at bottom - #debugLog IS the scrollable container
    const debugLogEl = $('#debugLog')[0];
    if (consoleAutoScroll && debugLogEl) {
        debugLogEl.scrollTop = debugLogEl.scrollHeight;
    }

    const debugLogDockEl = $('#debugLogDock')[0];
    if (consoleDockAutoScroll && debugLogDockEl) {
        debugLogDockEl.scrollTop = debugLogDockEl.scrollHeight;
    }

    // Apply current search filter
    filterConsoleEntries();
}

// Console search functionality
function filterConsoleEntries() {
    const searchText = $('#consoleSearchInput').val() || $('#consoleSearchInputDock').val();
    const useRegex = $('#consoleSearchRegex').is(':checked') || $('#consoleSearchRegexDock').is(':checked');

    if (!searchText) {
        $('.log-entry').removeClass('hidden').each(function() {
            $(this).html($(this).text());
        });
        return;
    }

    let pattern;
    try {
        pattern = useRegex ? new RegExp(searchText, 'gi') : null;
    } catch (e) {
        // Invalid regex, treat as plain text
        pattern = null;
    }

    $('.log-entry').each(function() {
        const entry = $(this);
        const text = entry.text();

        let matches = false;
        if (pattern) {
            matches = pattern.test(text);
        } else {
            matches = text.toLowerCase().includes(searchText.toLowerCase());
        }

        if (matches) {
            entry.removeClass('hidden');
            // Highlight matches
            let highlightedText = text;
            if (pattern) {
                highlightedText = text.replace(pattern, match => `<mark>${match}</mark>`);
            } else {
                const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                highlightedText = text.replace(regex, match => `<mark>${match}</mark>`);
            }
            entry.html(highlightedText);
        } else {
            entry.addClass('hidden');
        }
    });
}

// Sync search inputs
$('#consoleSearchInput, #consoleSearchInputDock').on('input', function() {
    const val = $(this).val();
    $('#consoleSearchInput, #consoleSearchInputDock').val(val);
    filterConsoleEntries();
});

$('#consoleSearchRegex, #consoleSearchRegexDock').on('change', function() {
    const checked = $(this).is(':checked');
    $('#consoleSearchRegex, #consoleSearchRegexDock').prop('checked', checked);
    filterConsoleEntries();
});

$('#consoleClearSearch, #consoleClearSearchDock').on('click', function() {
    $('#consoleSearchInput, #consoleSearchInputDock').val('');
    filterConsoleEntries();
});

// Console docking controls
function undockConsole() {
    const $dock = $('#consoleDock');

    // Keep console tab visible, but show redock placeholder in tab content
    $('.console-container').addClass('undocked-mode');
    $('#tab-console').addClass('show-redock-placeholder');

    // Remove docked class, add floating class
    $dock.removeClass('docked').addClass('floating');

    // Restore saved position or center it
    const savedPos = localStorage.getItem('console-dock-pos');
    if (savedPos) {
        const pos = JSON.parse(savedPos);
        $dock.css({ top: pos.top, left: pos.left, bottom: 'auto', right: 'auto' });
    } else {
        // Center the console panel
        const left = ($(window).width() - 600) / 2;
        const top = ($(window).height() - 300) / 2;
        $dock.css({ top: top, left: left, bottom: 'auto', right: 'auto' });
    }

    // Show the dock first
    $dock.show();

    // Enable draggable and resizable for floating mode
    $dock.draggable('enable');
    $dock.resizable('enable');
    $dock.resizable('option', 'handles', 'n, e, s, w, ne, nw, se, sw');
    $dock.resizable('option', 'maxHeight', 800);

    // Add hover effect on console tab when console is undocked
    $('.tab-btn[data-tab="console"]').on('mouseenter.consoledock', function() {
        $(this).addClass('pulsate-dock-target');
    }).on('mouseleave.consoledock', function() {
        // Only remove if not currently dragging
        if (!$dock.hasClass('ui-draggable-dragging')) {
            $(this).removeClass('pulsate-dock-target');
        }
    });
}

function redockConsole() {
    const $dock = $('#consoleDock');

    // Remove undocked mode from console tab
    $('.console-container').removeClass('undocked-mode');
    $('#tab-console').removeClass('show-redock-placeholder');

    // Remove hover listeners
    $('.tab-btn[data-tab="console"]').off('.consoledock');
    $('.tab-btn[data-tab="console"]').removeClass('pulsate-dock-target');

    // Disable draggable
    $dock.draggable('disable');

    // Configure resizable for docked mode (only top handle)
    $dock.resizable('option', 'handles', 'n');
    $dock.resizable('option', 'maxHeight', 600);

    // Remove floating class, add docked class
    $dock.removeClass('floating').addClass('docked');

    // Reset to bottom docked position
    $dock.css({ top: 'auto', left: 0, right: 0, bottom: 0 });

    // Hide floating window
    $dock.hide();

    // Force scroll to bottom after tab is displayed if auto-scroll is enabled
    setTimeout(function() {
        const debugLogEl = $('#debugLog')[0];
        if (consoleAutoScroll && debugLogEl) {
            debugLogEl.scrollTop = debugLogEl.scrollHeight;
        }
    }, 50);
}

$('#consoleUndockBtn').on('click', function() {
    undockConsole();
});

$('#consoleRedockBtn, #consoleRedockLargeBtn').on('click', function() {
    redockConsole();
});

// Toolbar redock button
$('#toolbarRedockBtn').on('click', function() {
    dockToolbarToZone();
});

// Console search collapse/expand
$('#consoleSearchToggle').on('click', function() {
    $('.console-search-wrapper').first().toggleClass('collapsed');
});

$('#consoleSearchToggleDock').on('click', function() {
    $('#consoleDock .console-search-wrapper').toggleClass('collapsed');
});

// Make console dock resizable and setup scroll listeners
$(document).ready(function() {
    const $dock = $('#consoleDock');

    // Initialize draggable once (disabled by default when docked)
    $dock.draggable({
        handle: '#consoleDockGrip',
        containment: 'window',
        disabled: true,
        drag: function(event, ui) {
            // Check if near the console tab
            const consoleTab = $('.tab-btn[data-tab="console"]');
            const tabOffset = consoleTab.offset();
            const tabWidth = consoleTab.outerWidth();
            const tabHeight = consoleTab.outerHeight();

            const dockOffset = ui.offset;
            const dockWidth = $dock.outerWidth();
            const dockHeight = 50; // Use header height for detection

            // Check if dragging near the console tab
            const nearTab = dockOffset.left < tabOffset.left + tabWidth + 100 &&
                           dockOffset.left + dockWidth > tabOffset.left - 100 &&
                           dockOffset.top < tabOffset.top + tabHeight + 100 &&
                           dockOffset.top + dockHeight > tabOffset.top - 100;

            if (nearTab) {
                consoleTab.addClass('pulsate-dock-target');
            } else {
                consoleTab.removeClass('pulsate-dock-target');
            }
        },
        stop: function(event, ui) {
            // Remove pulsate effect
            $('.tab-btn[data-tab="console"]').removeClass('pulsate-dock-target');

            // Save position
            localStorage.setItem('console-dock-pos', JSON.stringify({
                top: ui.position.top,
                left: ui.position.left
            }));
        }
    });

    // Initialize resizable once with all handles
    $dock.resizable({
        handles: 'n, e, s, w, ne, nw, se, sw',
        minHeight: 100,
        minWidth: 300,
        maxHeight: 600
    });

    // Setup scroll tracking for auto-scroll (tail -f behavior)
    // #debugLog IS the scrollable container with class .console-content
    $('#debugLog').on('scroll', function() {
        consoleAutoScroll = isScrolledToBottom(this);
    });

    $('#debugLogDock').on('scroll', function() {
        consoleDockAutoScroll = isScrolledToBottom(this);
    });

    // Optional: Show console dock on connect
    // $('#consoleDock').show();
});

function updateStatus(text, state) {
    $('#statusText').text(text);
    $('#statusIndicator').removeClass('connected paused').addClass(state);
}

function updateControls() {
    $('#pauseBtn').prop('disabled', isPaused);
    $('#resumeBtn, #stepOverBtn, #stepIntoBtn, #stepOutBtn').prop('disabled', !isPaused);
}

// Watch Management
function addWatch(expression) {
    if (!expression.trim()) return;
    watches.push({ expression, value: 'evaluating...' });
    renderWatches();
    if (isPaused) {
        evaluateWatch(expression, watches.length - 1);
    }
}

function removeWatch(index) {
    watches.splice(index, 1);
    renderWatches();
}

async function evaluateWatch(expression, index) {
    try {
        const result = await client.runtime.evaluate(expression, { returnByValue: true });
        if (watches[index]) {
            watches[index].value = result.result?.value ?? result.result?.description ?? 'undefined';
            renderWatches();
        }
    } catch (error) {
        if (watches[index]) {
            watches[index].value = `Error: ${error.message}`;
            renderWatches();
        }
    }
}

function renderWatches() {
    const $list = $('#watchesList');
    if (watches.length === 0) {
        $list.html('<div class="empty-state">No watches added</div>');
        return;
    }

    $list.empty();
    watches.forEach((watch, index) => {
        $list.append(`
            <div class="list-item">
                <div class="item-content">
                    <div class="variable-item">
                        <span class="variable-name">${watch.expression}:</span>
                        <span class="variable-value">${watch.value}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="item-action-btn" onclick="removeWatch(${index})" title="Remove">✕</button>
                </div>
            </div>
        `);
    });
}

// Breakpoint Management
function renderBreakpoints() {
    const $list = $('#breakpointsList');
    if (breakpoints.length === 0) {
        $list.html('<div class="empty-state">No breakpoints set</div>');
        return;
    }

    $list.empty();
    breakpoints.forEach((bp, index) => {
        $list.append(`
            <div class="list-item">
                <input type="checkbox" class="breakpoint-checkbox" ${bp.enabled ? 'checked' : ''}
                       onchange="toggleBreakpoint(${index})">
                <div class="item-content">
                    <div class="breakpoint-location">${bp.url || bp.scriptId}</div>
                    <div class="breakpoint-line">Line ${bp.lineNumber}</div>
                </div>
                <div class="item-actions">
                    <button class="item-action-btn" onclick="removeBreakpoint(${index})" title="Remove">✕</button>
                </div>
            </div>
        `);
    });
}

function toggleBreakpoint(index) {
    breakpoints[index].enabled = !breakpoints[index].enabled;
    // TODO: Call actual debugger API to enable/disable
    renderBreakpoints();
}

function removeBreakpoint(index) {
    const bp = breakpoints[index];
    if (bp.breakpointId) {
        client.debugger.removeBreakpoint(bp.breakpointId);
    }
    breakpoints.splice(index, 1);
    renderBreakpoints();
}

// Helper to format file path for display
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

// Simple syntax highlighter for JavaScript
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

// Fetch and display source code for a frame
async function fetchFrameSource(frame, frameIndex) {
    if (!frame.location?.scriptId) return null;

    try {
        const result = await client.debugger.getScriptSource(frame.location.scriptId);
        if (result.scriptSource) {
            const lines = result.scriptSource.split('\n');
            const lineNumber = frame.location.lineNumber;

            if (lineNumber < lines.length) {
                const codeLine = lines[lineNumber];
                const highlightedCode = highlightCode(codeLine, 'javascript');

                return {
                    lineNumber: lineNumber + 1, // 1-indexed for display
                    code: codeLine,
                    highlighted: highlightedCode
                };
            }
        }
    } catch (error) {
        console.warn('Could not fetch source for frame:', error);
    }

    return null;
}

// Call Stack Rendering
async function renderCallStack(callFrames) {
    currentCallFrames = callFrames || [];

    console.log('renderCallStack called with frames:', callFrames);

    if (!callFrames || callFrames.length === 0) {
        $('#callstack').html('<div class="empty-state">Pause execution to see call stack</div>');
        return;
    }

    $('#callstack').empty();

    for (let index = 0; index < callFrames.length; index++) {
        const frame = callFrames[index];
        console.log(`Frame ${index}:`, frame);
        const functionName = frame.functionName || '(anonymous)';

        // Try to get URL from frame, or look it up via scriptId
        let url = frame.url;
        if (!url && frame.location?.scriptId) {
            url = scriptMap.get(frame.location.scriptId);
        }
        if (!url) {
            url = 'unknown';
        }

        const displayPath = formatFilePath(url);
        const line = frame.location?.lineNumber ?? '?';
        const col = frame.location?.columnNumber ?? '?';

        // Build the frame HTML
        let frameHtml = `
            <div class="list-item ${index === 0 ? 'selected' : ''}" onclick="selectCallFrame(${index})">
                <div class="item-content">
                    <div class="function-name">${functionName}</div>
                    <div class="function-location" title="${url}">${displayPath}:${line}:${col}</div>
        `;

        // For the active frame (index 0), fetch and show source code
        if (index === 0) {
            const sourceInfo = await fetchFrameSource(frame, index);
            if (sourceInfo) {
                frameHtml += `
                    <div class="frame-code-preview">
                        <span class="code-line-number">${sourceInfo.lineNumber}</span>
                        <code class="code-line">${sourceInfo.highlighted}</code>
                    </div>
                `;
            }
        }

        frameHtml += `
                </div>
            </div>
        `;

        $('#callstack').append(frameHtml);
    }

    // Render scope for first frame
    if (callFrames.length > 0) {
        renderScope(callFrames[0].scopeChain);
    }
}

function selectCallFrame(index) {
    $('#callstack .list-item').removeClass('selected');
    $('#callstack .list-item').eq(index).addClass('selected');

    if (currentCallFrames[index]) {
        renderScope(currentCallFrames[index].scopeChain);
    }
}

// Scope Variables Rendering
async function renderScope(scopeChain) {
    const $scope = $('#scopeVariables');

    if (!scopeChain || scopeChain.length === 0) {
        $scope.html('<div class="empty-state">No scope information available</div>');
        return;
    }

    $scope.empty();

    for (const scope of scopeChain) {
        $scope.append(`<div style="margin-top: 8px; color: var(--text-secondary); font-weight: 600; font-size: var(--font-xs);">${scope.type.toUpperCase()}</div>`);

        if (scope.object?.objectId) {
            try {
                const props = await client.runtime.getProperties(scope.object.objectId, true);
                if (props.result) {
                    props.result.forEach(prop => {
                        const value = prop.value?.value ?? prop.value?.description ?? 'undefined';
                        $scope.append(`
                            <div class="variable-item">
                                <span class="variable-name">${prop.name}:</span>
                                <span class="variable-value">${value}</span>
                            </div>
                        `);
                    });
                }
            } catch (error) {
                $scope.append(`<div class="empty-state">Error loading properties</div>`);
            }
        }
    }
}

// Connection handling
$('#connectBtn').click(async function() {
    try {
        const wsUrl = $('#wsUrl').val();
        log(`Connecting to ${wsUrl}...`, 'info');

        // Initialize the BaseDomainController with the WebSocket URL
        const eventQueue = BaseDomainController.initialize(wsUrl);

        // Subscribe to console events before connecting
        eventQueue.queue.subscribe('Runtime.consoleAPICalled', (topic, message) => {
            const event = message.params;
            const args = event.args?.map(arg => arg.value ?? arg.description).join(' ') || '';
            const logType = event.type === 'error' ? 'error' : 'info';
            log(`console.${event.type}: ${args}`, logType);
        });

        // Subscribe to connection lifecycle events
        eventQueue.queue.subscribe('WebSocket.close', () => {
            log('Connection closed', 'error');
            updateStatus('Disconnected', 'disconnected');
            $('#debugControls').hide();
            $('#connectionControls').show();
            client = null;
        });

        // Connect to the WebSocket
        eventQueue.connect();

        // Wait for Proxy.ready event
        await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);

            eventQueue.queue.subscribe('Proxy.ready', () => {
                clearTimeout(timeoutId);
                log('Proxy ready', 'info');
                resolve();
            });

            eventQueue.queue.subscribe('WebSocket.error', (topic, data) => {
                clearTimeout(timeoutId);
                reject(new Error('Connection failed'));
            });
        });

        log('Connected successfully', 'info');
        updateStatus('Connected', 'connected');

        // Use controller instances from the event queue
        // Create a client-like object for compatibility with existing code
        client = {
            debugger: eventQueue.debuggerController,
            runtime: eventQueue.runtimeController,
            console: eventQueue.consoleController,
            disconnect: () => {
                if (eventQueue.ws) {
                    eventQueue.ws.close();
                }
            }
        };

        // Debugger events
        client.debugger.on('Debugger.paused', async (event) => {
            console.log('Debugger.paused event:', event);
            console.log('Call frames received:', event.callFrames?.length);

            log(`Paused: ${event.reason}`, 'event');
            isPaused = true;
            updateStatus('Paused', 'paused');
            updateControls();

            // Await call stack rendering to complete before evaluating watches
            await renderCallStack(event.callFrames);

            // Evaluate all watches (only if still paused - user might have resumed)
            if (isPaused) {
                for (let i = 0; i < watches.length; i++) {
                    await evaluateWatch(watches[i].expression, i);
                }
            }
        });

        client.debugger.on('Debugger.resumed', () => {
            log('Resumed execution', 'event');
            isPaused = false;
            updateStatus('Running', 'connected');
            updateControls();
            renderCallStack([]);
            $('#scopeVariables').html('<div class="empty-state">No scope information available</div>');
        });

        client.debugger.on('Debugger.scriptParsed', (event) => {
            // Store scriptId -> url mapping
            if (event.scriptId && event.url) {
                scriptMap.set(event.scriptId, event.url);
            }

            // Add to file tree
            if (event.scriptId && event.url) {
                addScriptToFileTree(event.scriptId, event.url);
            }

            // Log non-node_modules scripts
            if (event.url && !event.url.includes('node_modules')) {
                log(`Script parsed: ${event.url}`, 'info');
            }
        });

        client.debugger.on('Debugger.breakpointResolved', (event) => {
            log(`Breakpoint resolved: ${event.breakpointId}`, 'info');
        });

        // Runtime events
        client.runtime.on('Runtime.consoleAPICalled', (event) => {
            const args = event.args?.map(arg => arg.value ?? arg.description).join(' ') || '';
            log(`console.${event.type}: ${args}`, event.type === 'error' ? 'error' : 'info');
        });

        client.runtime.on('Runtime.exceptionThrown', (event) => {
            const msg = event.exceptionDetails?.exception?.description || 'Unknown error';
            log(`Exception: ${msg}`, 'error');
        });

        // Enable debugger and runtime
        await client.console.enable();
        await client.debugger.enable();
        await client.runtime.enable();

        // Update UI after successful connection and enable
        log('Debugger enabled', 'info');
        $('#connectionControls').hide();
        $('#debugControls').show();
        updateControls();

        // // Configure debugger for better call stack capture
        // try {
        //     await client.debugger.setAsyncCallStackDepth(32);
        //     log('Async call stack depth set to 32', 'info');
        // } catch (err) {
        //     console.warn('Could not set async call stack depth:', err);
        // }
        //
        // // Don't skip any pauses
        // try {
        //     await client.debugger.setSkipAllPauses(false);
        // } catch (err) {
        //     console.warn('Could not set skip pauses:', err);
        // }

    } catch (error) {
        log(`Connection error: ${error.message}`, 'error');
        updateStatus('Connection Failed', 'disconnected');
    }
});

$('#disconnectBtn').click(function() {
    if (client) {
        client.disconnect();
        client = null;
    }

    isPaused = false;
    watches = [];
    breakpoints = [];
    currentCallFrames = [];
    scriptMap.clear();

    $('#debugControls').hide();
    $('#connectionControls').show();
    $('#debugLog').html('<div class="empty-state">No console output</div>');
    $('#debugLogDock').html('<div class="empty-state">No console output</div>');
    $('#watchesList').html('<div class="empty-state">No watches added</div>');
    $('#breakpointsList').html('<div class="empty-state">No breakpoints set</div>');
    $('#projectFiles').empty();
    $('#dependencies').empty();
    $('#devDependencies').empty();
    $('#nodeInternalFiles').empty();
    updateStatus('Disconnected', 'disconnected');
    renderCallStack([]);
});

// Control button handlers
$('#pauseBtn').click(() => client.debugger.pause());

$('#resumeBtn').click(() => client.debugger.resume());

$('#stepOverBtn').click(() => {
    client.debugger.stepOver();
    $('.tab-btn[data-tab="callstack"]').click();
});
$('#stepIntoBtn').click(() => {
    client.debugger.stepInto();
    $('.tab-btn[data-tab="callstack"]').click();
});
$('#stepOutBtn').click(() => {
    client.debugger.stepOut();
    $('.tab-btn[data-tab="callstack"]').click();
});

// Watch button handler
$('#addWatchBtn').click(() => {
    const expression = $('#watchInput').val();
    if (expression) {
        addWatch(expression);
        $('#watchInput').val('');
    }
});

$('#watchInput').keypress((e) => {
    if (e.which === 13) { // Enter key
        $('#addWatchBtn').click();
    }
});
