# Bluetooth Implementation Migration

## Summary

BadgerBox has migrated from Node.js `serialport` to **Web Serial API** for Bluetooth Classic communication.

## What Changed

### Before (Legacy)
- **File**: `electron-bluetooth-manager.js`
- **Packages**: `serialport`, `@serialport/parser-readline`
- **Architecture**: Main process → IPC → Renderer
- **Downsides**: Native compilation, platform-specific issues, complex IPC

### After (Current)
- **Files**: `www/bluetooth/web-serial-manager.js`, `www/bluetooth/bluetooth-ui-controller.js`
- **Packages**: None (uses browser-native Web Serial API)
- **Architecture**: Renderer process only
- **Benefits**: No native modules, simpler code, cross-platform consistency

## Migration Status

✅ **Completed**:
- New Web Serial implementation created
- UI panel with terminal interface
- Toolbar button for access
- Full documentation

⏳ **Optional Cleanup**:
- Old `electron-bluetooth-manager.js` can be removed
- `serialport` dependencies can be removed from `package.json`
- Old IPC code in `electron-main.js` can be removed

## Keeping Legacy Code (Optional)

The `serialport` dependencies in `package.json` are currently **legacy** but kept for reference:

```json
"@serialport/parser-readline": "^12.0.0",  // LEGACY - can be removed
"serialport": "^12.0.0",                    // LEGACY - can be removed
```

These can be safely removed once you've verified the new Web Serial implementation works for your use case.

## Removing Legacy Dependencies

When ready, run:

```bash
npm uninstall serialport @serialport/parser-readline
```

This will:
- Remove native module dependencies
- Speed up `npm install`
- Eliminate platform-specific build issues
- Reduce package size

## Browser/Electron Requirements

The Web Serial API requires:
- **Minimum**: Chrome 117 or Electron 25
- **Current**: Electron 40 (you have this ✅)

## Testing Checklist

Before removing legacy code, verify:

- [ ] Can connect to paired Bluetooth devices
- [ ] Can send commands and receive responses
- [ ] Auto-reconnection works
- [ ] Terminal UI functions properly
- [ ] Command queueing works as expected

## Files That Can Be Removed

Once migration is complete:

1. `electron-bluetooth-manager.js` (root)
2. Any IPC handlers for Bluetooth in `electron-main.js`
3. serialport dependencies from `package.json`

## Rollback Plan

If issues arise, the old implementation can be restored:

1. Keep `electron-bluetooth-manager.js` (already done)
2. Re-run `npm install` (dependencies still in package.json)
3. Revert changes to `electron-main.js` if IPC removed

## Documentation

See `www/bluetooth/README.md` for full Web Serial API usage documentation.
