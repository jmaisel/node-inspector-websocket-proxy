# UI Controllers Test Page

This test page demonstrates all the refactored UI controllers with their extracted templates working in various container configurations.

## Purpose

After refactoring the controllers to separate HTML templates from controller logic, this page allows you to:

1. **Visual Testing**: See all controllers rendering correctly with their templates
2. **Layout Testing**: Test how controllers adapt to different container sizes (compact, standard, wide, tall)
3. **Template Verification**: Ensure all template functions generate correct HTML
4. **Interaction Testing**: Verify click handlers and interactive behaviors work properly

## Running the Test Page

### 1. Start the server:
```bash
cd /home/badger/Code/node-inspector-websocket-proxy
npm start
```

### 2. Open in browser:
```
http://localhost:8080/www/debugger/test-controllers.html
```

## What's Tested

### Call Stack Controller
- **Templates**: `callStackFrameTemplate`, `scopeVariableTemplate`, `scopeTypeHeaderTemplate`
- **Containers**: Standard, Compact, Wide & Tall
- **Features**: Multiple frames, source code preview, selected state

### Breakpoint Controller
- **Templates**: `breakpointItemTemplate`
- **Containers**: Standard, Multiple items
- **Features**: Enable/disable toggle, remove button, add form

### File Tree Controller
- **Templates**: `fileItemTemplate`
- **Containers**: Standard, Mixed files, Wide with many files
- **Features**: File selection, breakpoint button, hover states

### Console Controller
- **Templates**: `logEntryTemplate`
- **Containers**: Standard tall, With entries
- **Features**: Different log types (info, error, event), scrolling

## Test Actions

Use the buttons at the bottom of the page:

- **Populate Call Stacks** - Fills call stack containers with mock data
- **Populate Breakpoints** - Adds mock breakpoints
- **Populate File Trees** - Populates file trees with mock files
- **Populate Consoles** - Adds mock log entries
- **Clear All** - Resets all containers to empty state
- **Test Interactions** - Enables click handlers and logs to console

## Testing Workflow

1. Click "Populate X" buttons to fill each section with test data
2. Observe how templates render in different container sizes
3. Click "Test Interactions" to enable interactive behaviors
4. Click on items to test selection states
5. Check browser console for interaction logs
6. Toggle breakpoints and click remove buttons to test functionality

## Template Files Tested

Located in `www/debugger/templates/`:
- `callstack-template.js` - Call stack frames and scope variables
- `breakpoints-template.js` - Breakpoint items
- `file-tree-template.js` - File tree items
- `console-template.js` - Log entries

## Controller Files Using Templates

Located in `www/debugger/controllers/`:
- `CallStackUIController.js`
- `BreakpointUIController.js`
- `FileTreeUIController.js`
- `ConsoleUIController.js`

## Notes

- This is a standalone test page that uses only the templates, not the full controllers
- Mock data is generated in-browser to simulate various states
- No debugger connection is required
- All interactions are logged to the browser console
- Styles are simplified versions of the main debugger styles