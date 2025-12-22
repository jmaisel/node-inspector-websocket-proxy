/**
 * Unit tests for Debugger UI components
 * Tests individual UI functions and behaviors without requiring actual debugger connection
 */

describe('Debugger UI Unit Tests', function() {
    this.timeout(5000);

    // Reset test container before each test
    beforeEach(function() {
        // Clear console logs
        $('#debugLog').empty().append('<div class="empty-state">No console output</div>');
        $('#debugLogDock').empty().append('<div class="empty-state">No console output</div>');

        // Reset tabs
        $('.tab-btn').removeClass('active');
        $('.tab-btn[data-tab="console"]').addClass('active');
        $('.tab-pane').removeClass('active');
        $('#tab-console').addClass('active');

        // Clear lists
        $('#watchesList').html('<div class="empty-state">No watches added</div>');
        $('#breakpointsList').html('<div class="empty-state">No breakpoints set</div>');
        $('#callstack').html('<div class="empty-state">Pause execution to see call stack</div>');
        $('#scopeVariables').html('<div class="empty-state">No scope information available</div>');

        // Reset status
        $('#statusText').text('Disconnected');
        $('#statusIndicator').removeClass('connected paused');
    });

    describe('Icon Size Management', function() {
        it('should set icon size to small', function() {
            setIconSize('small');
            expect($('#toolbar').attr('data-icon-size')).to.equal('small');
        });

        it('should set icon size to medium', function() {
            setIconSize('medium');
            expect($('#toolbar').attr('data-icon-size')).to.equal('medium');
        });

        it('should set icon size to large', function() {
            setIconSize('large');
            expect($('#toolbar').attr('data-icon-size')).to.equal('large');
        });

        it('should persist icon size to localStorage', function() {
            setIconSize('large');
            expect(localStorage.getItem('debugger-icon-size')).to.equal('large');
        });

        it('should hide settings panel after setting size', function() {
            $('#settingsPanel').show();
            setIconSize('medium');
            expect($('#settingsPanel').is(':visible')).to.be.false;
        });
    });

    describe('Tab Navigation', function() {
        it('should switch to console tab', function() {
            $('.tab-btn[data-tab="console"]').click();
            expect($('.tab-btn[data-tab="console"]').hasClass('active')).to.be.true;
            expect($('#tab-console').hasClass('active')).to.be.true;
        });

        it('should switch to callstack tab', function() {
            $('.tab-btn[data-tab="callstack"]').click();
            expect($('.tab-btn[data-tab="callstack"]').hasClass('active')).to.be.true;
            expect($('#tab-callstack').hasClass('active')).to.be.true;
        });

        it('should switch to files tab', function() {
            $('.tab-btn[data-tab="files"]').click();
            expect($('.tab-btn[data-tab="files"]').hasClass('active')).to.be.true;
            expect($('#tab-files').hasClass('active')).to.be.true;
        });

        it('should deactivate previous tab when switching', function() {
            $('.tab-btn[data-tab="console"]').click();
            expect($('.tab-btn[data-tab="console"]').hasClass('active')).to.be.true;

            $('.tab-btn[data-tab="callstack"]').click();
            expect($('.tab-btn[data-tab="console"]').hasClass('active')).to.be.false;
            expect($('.tab-btn[data-tab="callstack"]').hasClass('active')).to.be.true;
        });
    });

    describe('Status Updates', function() {
        it('should update status text', function() {
            updateStatus('Connected', 'connected');
            expect($('#statusText').text()).to.equal('Connected');
        });

        it('should apply connected class', function() {
            updateStatus('Connected', 'connected');
            expect($('#statusIndicator').hasClass('connected')).to.be.true;
        });

        it('should apply paused class', function() {
            updateStatus('Paused', 'paused');
            expect($('#statusIndicator').hasClass('paused')).to.be.true;
        });

        it('should remove old status classes', function() {
            $('#statusIndicator').addClass('connected');
            updateStatus('Paused', 'paused');
            expect($('#statusIndicator').hasClass('connected')).to.be.false;
            expect($('#statusIndicator').hasClass('paused')).to.be.true;
        });
    });

    describe('Logging Functionality', function() {
        it('should add log entry to console', function() {
            log('Test message', 'info');
            const entries = $('#debugLog .log-entry');
            expect(entries.length).to.be.at.least(1);
            expect(entries.last().text()).to.include('Test message');
        });

        it('should add log entry to both consoles', function() {
            log('Test message', 'info');
            expect($('#debugLog .log-entry').length).to.be.at.least(1);
            expect($('#debugLogDock .log-entry').length).to.be.at.least(1);
        });

        it('should apply correct log type class', function() {
            log('Error message', 'error');
            expect($('#debugLog .log-entry').last().hasClass('error')).to.be.true;
        });

        it('should remove empty state when logging', function() {
            expect($('#debugLog .empty-state').length).to.equal(1);
            log('Test message', 'info');
            expect($('#debugLog .empty-state').length).to.equal(0);
        });

        it('should include timestamp in log entry', function() {
            log('Test message', 'info');
            const text = $('#debugLog .log-entry').last().text();
            expect(text).to.match(/\[\d{1,2}:\d{2}:\d{2}\]/);
        });
    });

    describe('File Categorization', function() {
        it('should categorize node internal files', function() {
            expect(categorizeScript('node:fs')).to.equal('node-internal');
            expect(categorizeScript('internal/modules/cjs/loader')).to.equal('node-internal');
        });

        it('should categorize project files', function() {
            expect(categorizeScript('file:///home/user/project/index.js')).to.equal('project');
        });

        it('should categorize dependency files', function() {
            packageDependencies.add('express');
            const result = categorizeScript('file:///home/user/project/node_modules/express/index.js');
            expect(result).to.equal('dependency');
        });

        it('should categorize devDependency files', function() {
            packageDevDependencies.add('mocha');
            const result = categorizeScript('file:///home/user/project/node_modules/mocha/index.js');
            expect(result).to.equal('devDependency');
        });

        it('should handle scoped packages', function() {
            packageDependencies.add('@babel/core');
            const result = categorizeScript('file:///node_modules/@babel/core/index.js');
            expect(result).to.equal('dependency');
        });

        it('should default to dependency for unknown node_modules', function() {
            const result = categorizeScript('file:///node_modules/unknown-package/index.js');
            expect(result).to.equal('dependency');
        });
    });

    describe('File Name Extraction', function() {
        it('should extract file name from file:// URL', function() {
            expect(getFileName('file:///home/user/project/index.js')).to.equal('index.js');
        });

        it('should handle node: protocol', function() {
            expect(getFileName('node:fs')).to.equal('node:fs');
        });

        it('should extract package name from node_modules', function() {
            const result = getFileName('file:///node_modules/express/index.js');
            expect(result).to.equal('express');
        });

        it('should handle scoped packages', function() {
            const result = getFileName('file:///node_modules/@babel/core/index.js');
            expect(result).to.equal('@babel/core');
        });

        it('should return unknown for null', function() {
            expect(getFileName(null)).to.equal('unknown');
        });
    });

    describe('File Path Formatting', function() {
        it('should format simple file path', function() {
            const result = formatFilePath('file:///home/user/index.js');
            expect(result).to.include('index.js');
        });

        it('should shorten long paths', function() {
            const result = formatFilePath('file:///very/long/path/to/my/project/src/index.js');
            expect(result).to.include('...');
        });

        it('should format node_modules paths', function() {
            const result = formatFilePath('file:///project/node_modules/express/lib/router.js');
            expect(result).to.include('node_modules/express');
        });

        it('should handle unknown paths', function() {
            expect(formatFilePath('unknown')).to.equal('unknown');
            expect(formatFilePath(null)).to.equal('unknown');
        });
    });

    describe('Watch Management', function() {
        beforeEach(function() {
            watches = [];
        });

        it('should add watch expression', function() {
            addWatch('x + y');
            expect(watches.length).to.equal(1);
            expect(watches[0].expression).to.equal('x + y');
        });

        it('should not add empty watch', function() {
            addWatch('   ');
            expect(watches.length).to.equal(0);
        });

        it('should render watches list', function() {
            addWatch('x + y');
            const items = $('#watchesList .list-item');
            expect(items.length).to.be.at.least(1);
        });

        it('should remove watch by index', function() {
            addWatch('x');
            addWatch('y');
            expect(watches.length).to.equal(2);

            removeWatch(0);
            expect(watches.length).to.equal(1);
            expect(watches[0].expression).to.equal('y');
        });

        it('should show empty state when no watches', function() {
            watches = [];
            renderWatches();
            expect($('#watchesList .empty-state').length).to.equal(1);
        });
    });

    describe('Breakpoint Management', function() {
        beforeEach(function() {
            breakpoints = [];
        });

        it('should render empty breakpoints list', function() {
            renderBreakpoints();
            expect($('#breakpointsList .empty-state').length).to.equal(1);
        });

        it('should render breakpoint items', function() {
            breakpoints = [
                { url: 'test.js', lineNumber: 10, enabled: true }
            ];
            renderBreakpoints();
            expect($('#breakpointsList .list-item').length).to.equal(1);
        });

        it('should toggle breakpoint enabled state', function() {
            breakpoints = [
                { url: 'test.js', lineNumber: 10, enabled: true }
            ];
            toggleBreakpoint(0);
            expect(breakpoints[0].enabled).to.be.false;
        });

        it('should remove breakpoint by index', function() {
            breakpoints = [
                { url: 'test.js', lineNumber: 10, enabled: true },
                { url: 'test.js', lineNumber: 20, enabled: true }
            ];

            // Mock client for remove call
            window.client = {
                debugger: {
                    removeBreakpoint: function() {}
                }
            };

            removeBreakpoint(0);
            expect(breakpoints.length).to.equal(1);
            expect(breakpoints[0].lineNumber).to.equal(20);
        });
    });

    describe('Console Search', function() {
        beforeEach(function() {
            $('#debugLog').empty();
            $('#debugLog').append('<div class="log-entry info">Test message one</div>');
            $('#debugLog').append('<div class="log-entry error">Error message two</div>');
            $('#debugLog').append('<div class="log-entry info">Another test three</div>');
        });

        it('should filter entries by plain text search', function() {
            $('#consoleSearchInput').val('Error');
            filterConsoleEntries();

            const visible = $('#debugLog .log-entry:not(.hidden)');
            expect(visible.length).to.equal(1);
            expect(visible.first().text()).to.include('Error');
        });

        it('should be case insensitive', function() {
            $('#consoleSearchInput').val('error');
            filterConsoleEntries();

            const visible = $('#debugLog .log-entry:not(.hidden)');
            expect(visible.length).to.equal(1);
        });

        it('should highlight matched text', function() {
            $('#consoleSearchInput').val('test');
            filterConsoleEntries();

            const visible = $('#debugLog .log-entry:not(.hidden)');
            expect(visible.first().html()).to.include('<mark>');
        });

        it('should support regex search', function() {
            $('#consoleSearchInput').val('message (one|two)');
            $('#consoleSearchRegex').prop('checked', true);
            filterConsoleEntries();

            const visible = $('#debugLog .log-entry:not(.hidden)');
            expect(visible.length).to.equal(2);
        });

        it('should show all entries when search is empty', function() {
            $('#consoleSearchInput').val('test');
            filterConsoleEntries();

            $('#consoleSearchInput').val('');
            filterConsoleEntries();

            const visible = $('#debugLog .log-entry:not(.hidden)');
            expect(visible.length).to.equal(3);
        });

        it('should handle invalid regex gracefully', function() {
            $('#consoleSearchInput').val('[invalid(');
            $('#consoleSearchRegex').prop('checked', true);

            // Should not throw
            filterConsoleEntries();
        });
    });

    describe('Control Button States', function() {
        it('should disable pause button when paused', function() {
            isPaused = false;
            updateControls();
            expect($('#pauseBtn').prop('disabled')).to.be.false;

            isPaused = true;
            updateControls();
            expect($('#pauseBtn').prop('disabled')).to.be.true;
        });

        it('should enable step buttons when paused', function() {
            isPaused = true;
            updateControls();
            expect($('#stepOverBtn').prop('disabled')).to.be.false;
            expect($('#stepIntoBtn').prop('disabled')).to.be.false;
            expect($('#stepOutBtn').prop('disabled')).to.be.false;
        });

        it('should disable step buttons when not paused', function() {
            isPaused = false;
            updateControls();
            expect($('#stepOverBtn').prop('disabled')).to.be.true;
            expect($('#stepIntoBtn').prop('disabled')).to.be.true;
            expect($('#stepOutBtn').prop('disabled')).to.be.true;
        });

        it('should enable resume button when paused', function() {
            isPaused = true;
            updateControls();
            expect($('#resumeBtn').prop('disabled')).to.be.false;
        });
    });

    describe('Syntax Highlighting', function() {
        it('should highlight keywords', function() {
            const code = 'const x = 10;';
            const result = highlightCode(code, 'javascript');
            expect(result).to.include('hl-keyword');
            expect(result).to.include('const');
        });

        it('should highlight strings', function() {
            const code = 'const str = "hello";';
            const result = highlightCode(code, 'javascript');
            expect(result).to.include('hl-string');
        });

        it('should highlight numbers', function() {
            const code = 'const num = 42;';
            const result = highlightCode(code, 'javascript');
            expect(result).to.include('hl-number');
        });

        it('should highlight comments', function() {
            const code = '// This is a comment';
            const result = highlightCode(code, 'javascript');
            expect(result).to.include('hl-comment');
        });

        it('should escape HTML entities', function() {
            const code = 'if (x < 10 && y > 5)';
            const result = highlightCode(code, 'javascript');
            expect(result).to.include('&lt;');
            expect(result).to.include('&gt;');
        });

        it('should return empty for null input', function() {
            const result = highlightCode(null);
            expect(result).to.equal('');
        });
    });

    describe('Scroll Tracking', function() {
        it('should detect when scrolled to bottom', function() {
            const element = document.createElement('div');
            element.scrollHeight = 1000;
            element.scrollTop = 950;
            element.clientHeight = 50;

            const result = isScrolledToBottom(element);
            expect(result).to.be.true;
        });

        it('should detect when not at bottom', function() {
            const element = document.createElement('div');
            element.scrollHeight = 1000;
            element.scrollTop = 500;
            element.clientHeight = 50;

            const result = isScrolledToBottom(element);
            expect(result).to.be.false;
        });

        it('should allow 5px threshold', function() {
            const element = document.createElement('div');
            element.scrollHeight = 1000;
            element.scrollTop = 946; // Within 5px threshold
            element.clientHeight = 50;

            const result = isScrolledToBottom(element);
            expect(result).to.be.true;
        });
    });
});
