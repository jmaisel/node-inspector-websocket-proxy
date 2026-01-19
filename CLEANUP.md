# Frontend Code Cleanup Plan

## Current State
- 65 custom JavaScript files
- ~16,827 lines of frontend code (excluding vendor)
- jQuery-based with mixed patterns
- No linting, no tests, no build tooling

## Cleanup Options

### Option 1: Quick Wins (RECOMMENDED - DO THIS FIRST)

**Effort:** Low - mostly mechanical changes
**Risk:** Low - targeted fixes
**Impact:** Prevents bugs, makes code maintainable enough to keep building on

**Tasks:**

1. **Add ESLint configuration**
   - Create `.eslintrc.json` with basic rules
   - Fix auto-fixable issues
   - Establish consistent code style

2. **Extract magic constants**
   - Create `www/app/constants.js`
   - Move hardcoded ports, magic numbers, message types
   - Files: All files using hardcoded values

3. **Fix synchronous AJAX → async/await**
   - Replace `$.ajax({ async: false })` calls
   - Convert to modern fetch/async patterns
   - Primary offender: `project-helper.js:207`

4. **Fix memory leaks**
   - Add WebSocket cleanup handlers in `gpio-websocket-client.js`
   - Remove event listeners on component unmount
   - Clear timers (reconnectTimer, etc.)

5. **Add error boundaries**
   - Wrap JSON.parse operations in try/catch
   - Add recovery logic for failed async operations
   - Log errors consistently

**Files to touch:** ~15 files (the worst offenders)

**Priority Quick Wins:**
- [x] Add `.eslintrc.json`
- [x] Fix synchronous AJAX in `project-helper.js:207`
- [x] Add WebSocket cleanup in `gpio-websocket-client.js`
- [x] Extract constants to `www/app/constants.js`
- [x] Add try/catch around all JSON.parse operations

---

### Option 2: Modular Refactoring (DO LATER IF ADDING MAJOR FEATURES)

**Effort:** Medium - requires understanding dependencies
**Risk:** Medium - potential to break integrations
**Impact:** Clear boundaries, much easier to maintain and extend

**Tasks:**

1. **Split god files:**
   - ✅ `project-helper.js` (1,018 lines) → `ProjectAPI`, `ProjectUI`, `ProjectFileTree`
   - ✅ `main.js` (688 lines) → `AppBootstrap`, `ModeController`, `GutterController`, `ObservableMap`
   - ⏳ `breadboard.js` (607 lines) → `BreadboardRenderer`, `BreadboardLogic`, `BreadboardEvents`
   - ⏳ `console-controller.js` (568 lines) → `ConsoleUI`, `MessageFormatter`, `LogFilter`

2. **Create proper module boundaries**
   - Define clear interfaces between modules
   - Use dependency injection instead of global state
   - Document module dependencies

3. **Remove jQuery from new modules**
   - Use vanilla DOM APIs in refactored code
   - Keep jQuery in legacy modules (don't rewrite everything)
   - Create helper utilities for common operations

4. **Add JSDoc to public APIs**
   - Document all public methods
   - Add type annotations
   - Include usage examples

**Files to touch:** ~25-30 files (split + refactor callers)

---

### Option 3: Full Rewrite (ONLY IF THIS BECOMES PRODUCTION SOFTWARE)

**Effort:** High - essentially building a new frontend
**Risk:** High - complete rewrite
**Impact:** Modern, maintainable, testable codebase

**Tasks:**
- Modern build tooling (Vite/webpack)
- TypeScript for type safety
- Replace jQuery with vanilla JS or Vue/React
- Proper state management (Redux/Pinia)
- Component-based architecture
- Unit tests
- Clean separation: UI components, business logic, API layer

**Files to touch:** All 65 files rewritten

**When to consider:**
- This becomes production software with users
- Committing to 6+ months of active development
- Need to scale the team

---

## Current Technical Debt

### Critical Issues (Option 1 addresses these)
- Memory leaks in WebSocket connections
- Synchronous AJAX calls freezing UI
- Uncaught promise rejections
- No input validation on message handlers
- Missing error recovery logic

### Moderate Issues (Option 2 addresses these)
- God files mixing concerns (1,000+ line files)
- Global state pollution
- Inconsistent async/promise patterns
- Dead code
- Inconsistent state management

### Architectural Issues (Option 3 addresses these)
- No clear module boundaries
- Tight coupling throughout
- jQuery dependency
- No test coverage
- No type safety

---

## Recommendation

**Do Option 1 now (nextish), consider Option 2 later.**

The codebase is functional and not on fire, but trending toward unmaintainable.

**Option 1 is worth doing because:**
- Prevents bugs (memory leaks, race conditions)
- Makes future development easier
- Low risk of breaking things
- Can be done incrementally

**Hold off on Option 2/3 unless:**
- Adding major new features
- Multiple people will work on this
- This becomes long-term production software

---

## Files Needing Most Attention

### Top Priority (Option 1):
1. `www/project/project-helper.js` (1,018 lines) - Synchronous AJAX, mixed concerns
2. `www/gpio/gpio-websocket-client.js` - Memory leaks in cleanup
3. All files with `JSON.parse()` - Need error handling

### Medium Priority (Option 2):
4. `www/app/main.js` (688 lines) - Application bootstrap god file
5. `www/breadboard/breadboard.js` (607 lines) - SVG + logic + events tangled
6. `www/console/console-controller.js` (568 lines) - UI + formatting + filtering mixed
7. `www/debugger/debugger-ui-controller.js` - Complex UI state management

### Solid Code (Keep as reference):
- `server/*` - Backend architecture is good
- `www/gpio/gpio-websocket-api.js` - Clean protocol design
- `util/workspace-security.js` - Good security patterns

---

## Notes

- Backend/server code is solid (7.5/10) - keep that pattern
- CircuitJS integration is well-designed - the mess is in surrounding UI code
- Most code was written during rapid prototyping - expected technical debt
- Cleanup is preventative maintenance, not urgent
