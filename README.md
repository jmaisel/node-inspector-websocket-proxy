# Node.js Debugger Wrapper

WebSocket-based debugger wrapper with comprehensive UI and test suite.

## 🚀 Quick Start

```bash
# Run all tests with HTML report
npm run test:all

# Run smoke tests
npm run test:smoke

# View test report
open test-reports/ui-test-report.html
```

## 📊 Current Status

✅ **Test Suite Complete** - 32 E2E tests passing consistently
🚧 **Integration Phase** - Ready for system integration

See **[STATUS.md](STATUS.md)** for detailed project status.

## 📋 Documentation

| Document | Description |
|----------|-------------|
| **[STATUS.md](STATUS.md)** | Project status, progress tracking, and metrics |
| **[TODO.md](TODO.md)** | Remaining tasks for integration phase |
| **[TESTING_COMPLETE.md](TESTING_COMPLETE.md)** | Test framework guide and usage |
| **[test/README.md](test/README.md)** | Test suite documentation |
| **[CLAUDE.md](CLAUDE.md)** | CDP commands reference |

## 🧪 Test Suite

- **32 E2E Tests** - Full UI workflow coverage
- **Unit Tests** - Tab navigation and state management
- **HTML Reports** - Mochawesome reporting with charts
- **Multiple Modes** - Headless and headed execution
- **Stable** - 3 consecutive clean runs verified

### Test Commands

```bash
# Full test suite with report (recommended)
npm run test:all

# Quick smoke tests
npm run test:smoke

# E2E tests only
npm run test:ui:e2e

# E2E with visible browser (for debugging)
npm run test:ui:e2e:headed

# E2E with report
npm run test:ui:e2e:report
```

## 🏷️ Git Tags

- **`test-suite-stable`** - All 32 UI tests passing - baseline for integration

## 📁 Project Structure

```
debugger-wrapper/
├── debugger/              # UI components
│   ├── debugger.html     # Main UI
│   ├── styles.css        # UI styles
│   └── main.js           # UI logic
├── test/                 # Test suite
│   ├── debugger-ui-e2e.test.js    # 32 E2E tests
│   ├── debugger-ui-unit.test.js   # Unit tests
│   ├── run-ui-tests.js            # Test runner
│   └── README.md                  # Test documentation
├── test-reports/         # Generated reports (gitignored)
├── STATUS.md            # Project status
├── TODO.md              # Remaining tasks
└── package.json         # Dependencies and scripts
```

## 🎯 Next Steps

1. **Review Integration Requirements** - Understand how wrapper fits into existing system
2. **API Compatibility Check** - Verify wrapper API matches expectations
3. **Begin Integration** - Start with simplest integration path

See **[TODO.md](TODO.md)** for detailed integration tasks.

## 🔧 Development

### Prerequisites

- Node.js (v14+)
- Chrome/Chromium browser
- ChromeDriver (auto-installed)

### Setup

```bash
npm install
node test/validate-setup.js
```

### Running the Debugger

```bash
# Start proxy server
node inspector-proxy-factory.js

# Open debugger UI
open debugger/debugger.html
```

## 📝 Notes

- Test suite uses `jsClick()` to bypass element interception
- Tests validate actual UI behavior, not implementation details
- All tests wait for proper state changes (no fixed sleeps)
- Test framework is CI/CD ready

---

**Project Status:** Test suite complete ✅ | Integration phase pending 🚧

For questions or issues, see the documentation files listed above.
