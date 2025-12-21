let client = null;
let isPaused = false;
let watches = [];
let breakpoints = [];
let currentCallFrames = [];
let scriptMap = new Map(); // scriptId -> url mapping

// Panel toggle function
function togglePanel(panelId) {
    $('#' + panelId).toggleClass('collapsed');
}

// Logging
function log(message, type = 'info') {
    // Remove empty state if exists
    $('#debugLog .empty-state').remove();

    const timestamp = new Date().toLocaleTimeString();
    $('#debugLog').append(`<div class="log-entry ${type}">[${timestamp}] ${message}</div>`);
    $('#debugLog').scrollTop($('#debugLog')[0].scrollHeight);
}

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

// Call Stack Rendering
function renderCallStack(callFrames) {
    currentCallFrames = callFrames || [];

    console.log('renderCallStack called with frames:', callFrames);

    if (!callFrames || callFrames.length === 0) {
        $('#callstack').html('<div class="empty-state">Pause execution to see call stack</div>');
        return;
    }

    $('#callstack').empty();

    callFrames.forEach((frame, index) => {
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

        $('#callstack').append(`
            <div class="list-item ${index === 0 ? 'selected' : ''}" onclick="selectCallFrame(${index})">
                <div class="item-content">
                    <div class="function-name">${functionName}</div>
                    <div class="function-location" title="${url}">${displayPath}:${line}:${col}</div>
                </div>
            </div>
        `);
    });

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

        client = new InspectorBrowserClient(wsUrl);
        await client.connect();
        log('Connected successfully', 'info');
        updateStatus('Connected', 'connected');

        // Debugger events
        client.debugger.on('Debugger.paused', async (event) => {
            console.log('Debugger.paused event:', event);
            console.log('Call frames received:', event.callFrames?.length);

            log(`Paused: ${event.reason}`, 'event');
            isPaused = true;
            updateStatus('Paused', 'paused');
            updateControls();
            renderCallStack(event.callFrames);

            // Evaluate all watches
            for (let i = 0; i < watches.length; i++) {
                await evaluateWatch(watches[i].expression, i);
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

        client.debugger.on('Debugger.enable', (event) => {
            log('Debugger enabled', 'info');
            $('#connectionPanel').hide();
            $('#controls, #content').show();
            updateControls();
        });

        // Enable debugger and runtime
        await client.debugger.enable();
        await client.runtime.enable();

        // Configure debugger for better call stack capture
        try {
            await client.debugger.setAsyncCallStackDepth(32);
            log('Async call stack depth set to 32', 'info');
        } catch (err) {
            console.warn('Could not set async call stack depth:', err);
        }

        // Don't skip any pauses
        try {
            await client.debugger.setSkipAllPauses(false);
        } catch (err) {
            console.warn('Could not set skip pauses:', err);
        }

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

    $('#connectionPanel').show();
    $('#controls, #content').hide();
    $('#debugLog').html('<div class="empty-state">No console output</div>');
    $('#watchesList').html('<div class="empty-state">No watches added</div>');
    $('#breakpointsList').html('<div class="empty-state">No breakpoints set</div>');
    updateStatus('Disconnected', 'disconnected');
    renderCallStack([]);
});

// Control button handlers
$('#pauseBtn').click(() => client.debugger.pause());
$('#resumeBtn').click(() => client.debugger.resume());
$('#stepOverBtn').click(() => client.debugger.stepOver());
$('#stepIntoBtn').click(() => client.debugger.stepInto());
$('#stepOutBtn').click(() => client.debugger.stepOut());

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
