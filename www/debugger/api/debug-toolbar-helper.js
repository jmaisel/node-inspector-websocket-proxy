/**
 * DebugToolbarHelper - Manages the debug toolbar and breakpoints panel
 */
class DebugToolbarHelper {
    constructor(ace) {
        this.ace = ace;
        this.logger = new Logger("DebugToolbarHelper");
        this.breakpointsPanel = null;
        this.breakpoints = new Map(); // breakpointId -> { file, line, condition, enabled }
        this.allBreakpointsActive = true; // Track global breakpoints state
    }

    initialize() {
        this.logger.info("initialize()");
        this.renderDebugToolbar();
        this.setupBreakpointsPanel();
        this.setupEventListeners();
    }

    renderDebugToolbar() {
        this.logger.info("renderDebugToolbar()");
        const toolbar = $('#debug-toolbar');
        toolbar.html(`
            <div class="toolbar-btn-group">
                <button id="show-breakpoints-btn" class="toolbar-btn">
                    🔴 Debug
                </button>
                <span class="toolbar-btn-label">Breakpoints</span>
            </div>
        `);
    }

    setupBreakpointsPanel() {
        this.logger.info("setupBreakpointsPanel()");
        this.breakpointsPanel = $('#breakpoints-panel');

        // Make draggable
        this.breakpointsPanel.draggable({
            handle: '.draggable-header',
            containment: 'window'
        });

        // Set initial position
        this.breakpointsPanel.css({
            top: '100px',
            right: '20px',
            width: '350px',
            height: '400px'
        });
    }

    setupEventListeners() {
        this.logger.info("setupEventListeners()");

        // Toggle panel visibility
        $('#show-breakpoints-btn').on('click', () => {
            this.logger.info("Show breakpoints button clicked");
            this.toggleBreakpointsPanel();
        });

        // Close button
        this.breakpointsPanel.find('.close-btn').on('click', () => {
            this.logger.info("Close button clicked");
            this.hideBreakpointsPanel();
        });

        // Note: Debugger.breakpointResolved listener is set up in debugger-connection-helper.js
        // after connection is established to avoid duplicate listeners
        this.logger.info("Breakpoint event listener will be set up via connection helper when debugger connects");

        // Listen for breakpoint clicks in list
        $('#breakpoints-list').on('click', '.breakpoint-item', (e) => {
            const item = $(e.currentTarget);
            const file = item.data('file');
            const line = item.data('line');
            this.logger.info("Breakpoint item clicked", file, line);
            this.navigateToBreakpoint(file, line);
        });

        // Listen for breakpoint delete
        $('#breakpoints-list').on('click', '.breakpoint-delete', (e) => {
            e.stopPropagation();
            const item = $(e.currentTarget).closest('.breakpoint-item');
            const breakpointId = item.data('breakpoint-id');
            this.logger.info("Breakpoint delete clicked", breakpointId);
            this.removeBreakpoint(breakpointId);
        });

        // Listen for individual breakpoint toggle
        $('#breakpoints-list').on('click', '.breakpoint-toggle', (e) => {
            e.stopPropagation();
            const item = $(e.currentTarget).closest('.breakpoint-item');
            const breakpointId = item.data('breakpoint-id');
            this.logger.info("Breakpoint toggle clicked", breakpointId);
            this.toggleBreakpoint(breakpointId);
        });

        // Listen for global toggle all breakpoints
        $('#toggle-all-breakpoints-btn').on('click', () => {
            this.logger.info("Toggle all breakpoints clicked");
            this.toggleAllBreakpoints();
        });
    }

    toggleBreakpointsPanel() {
        if (this.breakpointsPanel.is(':visible')) {
            this.hideBreakpointsPanel();
        } else {
            this.showBreakpointsPanel();
        }
    }

    showBreakpointsPanel() {
        this.logger.info("showBreakpointsPanel()");
        this.breakpointsPanel.fadeIn(200);
    }

    hideBreakpointsPanel() {
        this.logger.info("hideBreakpointsPanel()");
        this.breakpointsPanel.fadeOut(200);
    }

    onBreakpointResolved(params) {
        this.logger.info("onBreakpointResolved called with params:", params);

        const { breakpointId, location } = params;

        if (!breakpointId || !location) {
            this.logger.error("Invalid breakpoint resolved params:", params);
            return;
        }

        this.logger.info("Processing breakpoint:", {
            breakpointId: breakpointId,
            scriptUrl: location.scriptUrl,
            lineNumber: location.lineNumber,
            scriptId: location.scriptId
        });

        // Check if this is an update to an existing pending breakpoint
        const existingBreakpoint = this.breakpoints.get(breakpointId);

        if (existingBreakpoint) {
            // Update existing breakpoint with resolved location info
            this.logger.info("Updating existing breakpoint with resolved location");
            existingBreakpoint.file = location.scriptUrl || existingBreakpoint.file;
            existingBreakpoint.line = location.lineNumber;
            existingBreakpoint.scriptId = location.scriptId;
            existingBreakpoint.pending = false; // No longer pending
            this.breakpoints.set(breakpointId, existingBreakpoint);
        } else {
            // New breakpoint (resolved immediately in response)
            this.logger.info("Adding new resolved breakpoint");
            this.breakpoints.set(breakpointId, {
                id: breakpointId,
                file: location.scriptUrl || 'unknown',
                line: location.lineNumber,
                scriptId: location.scriptId,
                enabled: true, // Breakpoints are enabled by default
                pending: false
            });
        }

        this.logger.info("Breakpoints map now has", this.breakpoints.size, "breakpoints");

        // Update UI
        this.updateBreakpointsList();
    }

    updateBreakpointsList() {
        this.logger.info("updateBreakpointsList(), count:", this.breakpoints.size);

        // Update ALL breakpoints lists (there may be multiple with same ID)
        const lists = $('[id="breakpoints-list"]');
        lists.empty();

        if (this.breakpoints.size === 0) {
            $('.breakpoints-empty').show();
            return;
        }

        $('.breakpoints-empty').hide();

        this.breakpoints.forEach((bp) => {
            const fileName = bp.file.split('/').pop();
            const enabledClass = bp.enabled ? '' : 'disabled';
            const toggleText = bp.enabled ? 'Enabled' : 'Disabled';
            const toggleClass = bp.enabled ? '' : 'disabled';

            const item = $(`
                <li class="breakpoint-item ${enabledClass}"
                    data-breakpoint-id="${bp.id}"
                    data-file="${bp.file}"
                    data-line="${bp.line}">
                    <span class="breakpoint-icon">🔴</span>
                    <span class="breakpoint-info">
                        <span class="breakpoint-file">${fileName}</span>
                        <span class="breakpoint-line">:${bp.line + 1}</span>
                    </span>
                    <button class="breakpoint-toggle ${toggleClass}" title="Enable/Disable breakpoint">${toggleText}</button>
                    <button class="breakpoint-delete" title="Remove breakpoint">×</button>
                </li>
            `);
            // Append to all lists
            lists.each(function() {
                $(this).append(item.clone(true, true));
            });
        });
    }

    navigateToBreakpoint(file, line) {
        this.logger.info("navigateToBreakpoint", file, line);

        // Navigate editor to the line
        if (this.ace.editorHelper) {
            // Just navigate to the line (file should already be open)
            this.ace.editorHelper.gotoLine(line);
            this.logger.info("Navigated to line", line);
        } else {
            this.logger.warn("Cannot navigate to breakpoint: editorHelper not available");
        }
    }

    removeBreakpoint(breakpointId) {
        this.logger.info("removeBreakpoint", breakpointId);

        // Get the breakpoint info before removing it
        const breakpoint = this.breakpoints.get(breakpointId);

        if (breakpoint) {
            this.logger.info("Removing breakpoint at line", breakpoint.line);

            // Remove visual marker from ACE editor
            if (this.ace.editor && this.ace.editor.session) {
                this.ace.editor.session.clearBreakpoint(breakpoint.line);
                this.logger.info("Cleared breakpoint visual from editor");
            }
        }

        // Remove from debugger
        if (this.ace.inspectorProxy) {
            const debuggerController = this.ace.inspectorProxy.debuggerController;
            debuggerController.removeBreakpoint(breakpointId)
                .then(() => {
                    this.logger.info("Breakpoint removed from debugger successfully");
                })
                .catch((error) => {
                    this.logger.error("Failed to remove breakpoint from debugger", error);
                });
        }

        // Remove from map
        this.breakpoints.delete(breakpointId);

        // Update UI
        this.updateBreakpointsList();
    }

    toggleBreakpoint(breakpointId) {
        this.logger.info("toggleBreakpoint", breakpointId);

        const breakpoint = this.breakpoints.get(breakpointId);
        if (!breakpoint) {
            this.logger.warn("Breakpoint not found:", breakpointId);
            return;
        }

        // Toggle the enabled state
        breakpoint.enabled = !breakpoint.enabled;
        this.logger.info("Breakpoint is now", breakpoint.enabled ? "enabled" : "disabled");

        // Update debugger - remove or re-add the breakpoint
        if (this.ace.inspectorProxy && this.ace.inspectorProxy.debuggerController) {
            const debuggerController = this.ace.inspectorProxy.debuggerController;

            if (breakpoint.enabled) {
                // Re-enable: add the breakpoint back to the debugger
                const fullUrl = breakpoint.file;
                debuggerController.setBreakpointByUrl(breakpoint.line, fullUrl, 0, '')
                    .then((result) => {
                        this.logger.info("Breakpoint re-enabled in debugger", result);
                        // Update breakpoint ID if it changed
                        if (result && result.breakpointId) {
                            const oldId = breakpointId;
                            breakpoint.id = result.breakpointId;
                            // Update the map with new ID
                            this.breakpoints.delete(oldId);
                            this.breakpoints.set(result.breakpointId, breakpoint);
                            this.updateBreakpointsList();
                        }
                    })
                    .catch((error) => {
                        this.logger.error("Failed to re-enable breakpoint in debugger", error);
                    });
            } else {
                // Disable: remove the breakpoint from the debugger
                debuggerController.removeBreakpoint(breakpointId)
                    .then(() => {
                        this.logger.info("Breakpoint disabled in debugger");
                    })
                    .catch((error) => {
                        this.logger.error("Failed to disable breakpoint in debugger", error);
                    });
            }
        }

        // Update ACE editor visual
        if (this.ace.editor && this.ace.editor.session) {
            if (breakpoint.enabled) {
                // Re-enable: add red dot
                this.ace.editor.session.setBreakpoint(breakpoint.line, "ace_breakpoint");
            } else {
                // Disable: remove red dot (we could add a gray dot class in the future)
                this.ace.editor.session.clearBreakpoint(breakpoint.line);
            }
        }

        // Update the UI
        this.updateBreakpointsList();
    }

    toggleAllBreakpoints() {
        this.logger.info("toggleAllBreakpoints");

        // Toggle the global state
        this.allBreakpointsActive = !this.allBreakpointsActive;
        this.logger.info("All breakpoints are now", this.allBreakpointsActive ? "active" : "inactive");

        // Update debugger
        if (this.ace.inspectorProxy && this.ace.inspectorProxy.debuggerController) {
            const debuggerController = this.ace.inspectorProxy.debuggerController;
            debuggerController.setBreakpointsActive(this.allBreakpointsActive)
                .then(() => {
                    this.logger.info("Debugger breakpoints active state updated");
                })
                .catch((error) => {
                    this.logger.error("Failed to update breakpoints active state", error);
                });
        }

        // Update the global toggle button
        const toggleBtn = $('#toggle-all-breakpoints-btn');
        const toggleIcon = toggleBtn.find('.toggle-icon');

        if (this.allBreakpointsActive) {
            toggleBtn.removeClass('inactive');
            toggleIcon.text('✓');
            toggleBtn.html('<span class="toggle-icon">✓</span> All Active');
        } else {
            toggleBtn.addClass('inactive');
            toggleIcon.text('✗');
            toggleBtn.html('<span class="toggle-icon">✗</span> All Inactive');
        }
    }

    // Called when breakpoint is added via ACE editor gutter click
    onBreakpointAdded(file, line) {
        this.logger.info("onBreakpointAdded", file, line);

        // Check if debugger is connected
        if (!this.ace.inspectorProxy) {
            this.logger.warn("❌ Cannot set breakpoint: debugger not connected");
            this.logger.warn("Please connect to the debugger first using the Debug button in the code toolbar");
            alert("Please connect to the debugger first before setting breakpoints.\n\nClick the 'Debug' button in the code toolbar.");
            return;
        }

        this.logger.info("✓ Inspector proxy available");

        // Check if websocket is open
        if (!this.ace.inspectorProxy.ws) {
            this.logger.warn("❌ Cannot set breakpoint: WebSocket not available");
            return;
        }

        this.logger.info("✓ WebSocket exists, readyState:", this.ace.inspectorProxy.ws.readyState, "(1=OPEN)");

        if (this.ace.inspectorProxy.ws.readyState !== WebSocket.OPEN) {
            this.logger.warn("❌ Cannot set breakpoint: WebSocket not open (readyState:", this.ace.inspectorProxy.ws.readyState, ")");
            alert("Debugger connection is not active.\n\nPlease click the 'Debug' button and wait for the connection to establish.");
            return;
        }

        this.logger.info("✓ WebSocket is OPEN")

        const debuggerController = this.ace.inspectorProxy.debuggerController;

        // Find the script URL that matches the current file
        let scriptUrl = file;

        // Check if we have scripts loaded and try to find a matching URL
        if (this.ace.scripts && this.ace.scripts.size > 0) {
            this.logger.info("Searching for matching script URL in", this.ace.scripts.size, "scripts");
            // Look for a script whose URL ends with the filename
            for (const [scriptId, script] of this.ace.scripts) {
                this.logger.debug("Checking script:", scriptId, script.url);
                if (script.url && (script.url.endsWith(file) || script.url.includes(file))) {
                    scriptUrl = script.url;
                    this.logger.info("Found matching script URL:", scriptUrl, "for file:", file);
                    break;
                }
            }
        } else {
            this.logger.warn("No scripts loaded yet. Using filename as URL:", file);
        }

        // Construct the full file:// URL using workspace root
        // Script URLs look like: file:///tmp/node-inspector-websocket-proxy/demo-project/fixtures/steppable-script.js
        // Our file path looks like: /demo-project/fixtures/steppable-script.js
        let fullUrl = scriptUrl;

        if (this.ace.workspaceInfo && this.ace.workspaceInfo.workspaceRoot) {
            const workspaceRoot = this.ace.workspaceInfo.workspaceRoot;
            this.logger.info("Using workspace root:", workspaceRoot);

            // Construct file:// URL
            // Remove leading slash from scriptUrl if present
            const relativePath = scriptUrl.startsWith('/') ? scriptUrl.substring(1) : scriptUrl;
            fullUrl = `file://${workspaceRoot}/${relativePath}`;
        } else {
            this.logger.warn("Workspace info not available, using path as-is:", scriptUrl);
        }

        this.logger.info("Setting breakpoint at URL:", fullUrl, "line:", line);

        // Call with correct parameter order: (lineNumber, url, columnNumber, condition)
        debuggerController.setBreakpointByUrl(line, fullUrl, 0, '')
            .then((result) => {
                this.logger.info("Breakpoint set successfully", result);

                if (!result || !result.breakpointId) {
                    this.logger.error("Breakpoint response missing breakpointId:", result);
                    return;
                }

                // Check if the response contains locations immediately
                if (result.locations && result.locations.length > 0) {
                    // Immediate response with locations - process now
                    const location = result.locations[0];
                    this.logger.info("Breakpoint resolved immediately in response:", {
                        breakpointId: result.breakpointId,
                        scriptId: location.scriptId,
                        lineNumber: location.lineNumber
                    });

                    // Add to breakpoints list
                    this.onBreakpointResolved({
                        breakpointId: result.breakpointId,
                        location: {
                            scriptId: location.scriptId,
                            scriptUrl: fullUrl,
                            lineNumber: location.lineNumber,
                            columnNumber: location.columnNumber || 0
                        }
                    });
                } else {
                    // No locations in immediate response - will be resolved via Debugger.breakpointResolved event
                    this.logger.info("Breakpoint created with ID", result.breakpointId, "- waiting for Debugger.breakpointResolved event");

                    // Store a pending breakpoint entry so we can track it
                    this.breakpoints.set(result.breakpointId, {
                        id: result.breakpointId,
                        file: fullUrl,
                        line: line,
                        scriptId: null, // Will be filled in by breakpointResolved event
                        enabled: true,
                        pending: true // Mark as pending resolution
                    });

                    // Update UI to show pending breakpoint
                    this.updateBreakpointsList();

                    this.logger.info("Pending breakpoint stored, waiting for resolution event");
                }
            })
            .catch((error) => {
                this.logger.error("Failed to set breakpoint", error);
                alert(`Failed to set breakpoint: ${error.message || error}`);
            });
    }

    // Called when breakpoint is removed via ACE editor gutter click
    onBreakpointRemoved(file, line) {
        this.logger.info("onBreakpointRemoved", file, line);

        // Find and remove the breakpoint by file and line
        // Note: bp.file might be a full URL like "file:///tmp/workspace/foo.js"
        // while file parameter might just be "foo.js" or a relative path
        let breakpointIdToRemove = null;
        this.breakpoints.forEach((bp, id) => {
            const match = (bp.file === file) ||
                         (bp.file.endsWith(file)) ||
                         (bp.file.includes(file));
            if (match && bp.line === line) {
                breakpointIdToRemove = id;
            }
        });

        if (breakpointIdToRemove) {
            this.removeBreakpoint(breakpointIdToRemove);
        } else {
            this.logger.warn("Could not find breakpoint to remove", file, line);
            this.logger.warn("Available breakpoints:", Array.from(this.breakpoints.values()));
        }
    }
}
