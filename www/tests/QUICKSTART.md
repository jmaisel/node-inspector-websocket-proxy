# WebDriver Tests - Quick Start Guide

## Prerequisites

- Node.js (v16 or higher)
- Chrome browser installed
- Application server running (typically on `http://localhost:3000`)

## Initial Setup

1. **Install test dependencies**:
   ```bash
   # From project root
   npm run test:install

   # Or directly in tests directory
   cd www/tests
   npm install
   ```

2. **Start the application server**:
   ```bash
   # From project root
   cd server
   npm install  # First time only
   npm start
   ```

   The server will start on `http://localhost:8080` and serve the www/ directory.

3. **Verify server is running**:
   Open `http://localhost:8080/app/index.html` in your browser to confirm the app loads.

## Running Tests

### From Project Root

```bash
# Run all tests
npm test

# Run tests in headless mode
npm run test:headless

# Run specific test file
npm run test:spec specs/toolbar.spec.js
```

### From www/tests Directory

```bash
cd www/tests

# Run all tests
npm test

# Run tests in headless mode
npm run test:headless

# Run specific test file
npm run test:spec -- specs/toolbar.spec.js

# Run tests matching a pattern
npm run test:spec -- specs/*console*.spec.js
```

## Test Suite Overview

The test suite includes comprehensive coverage of:

- **Splash Screen** (`splash.spec.js`) - Loading screen and initialization
- **Toolbar** (`toolbar.spec.js`) - Project menu, mode switching, debug controls
- **Code Editor** (`editor.spec.js`) - File tree, tabs, editor iframe
- **Console** (`console.spec.js`) - Console panel, tabs, filtering
- **Circuit Simulator** (`circuit.spec.js`) - Circuit iframe and loading
- **Breadboard** (`breadboard.spec.js`) - Breadboard view and controls
- **Gutter Controls** (`gutter.spec.js`) - Layout manipulation
- **Connection Dialog** (`connection.spec.js`) - Bluetooth/Serial connection
- **Integration** (`integration.spec.js`) - End-to-end workflows

## Test Execution Time

- Full test suite: ~2-3 minutes
- Individual spec: ~10-30 seconds

## Troubleshooting

### Tests fail to start

**Problem**: `ERROR: Cannot find module...`

**Solution**: Run `npm install` in the `www/tests` directory

### Browser doesn't launch

**Problem**: `ERROR: ChromeDriver not found`

**Solution**:
```bash
cd www/tests
npm install chromedriver --force
```

### Application not loading

**Problem**: Tests timeout waiting for application

**Solution**:
1. Ensure application is running
2. Check the `baseUrl` in `wdio.conf.js` matches your server
3. Verify you can manually open the URL in a browser

### Tests pass locally but fail in CI

**Problem**: Tests work on your machine but not in CI environment

**Solution**:
1. Use headless mode in CI: `npm run test:headless`
2. Set environment variable: `HEADLESS=true`
3. Ensure Chrome is installed in CI environment

### Splash screen timeout

**Problem**: Tests timeout waiting for splash to disappear

**Solution**:
1. Increase timeout in test: `await SplashPage.waitForSplashToDisappear({ timeout: 60000 })`
2. Check if app is loading correctly in browser

## Viewing Test Results

Test results are displayed in the console with:
- ✓ Passing tests (green)
- ✗ Failing tests (red)
- Test execution time
- Error messages and stack traces

Screenshots are automatically captured on test failures and saved to the `www/tests` directory.

## Next Steps

- Read [CONTRIBUTING.md](CONTRIBUTING.md) to learn how to add new tests
- Review [README.md](README.md) for detailed documentation
- Check individual spec files for test examples
- Explore `helpers/page-objects.js` to understand the page object model

## CI/CD Integration Example

```yaml
# .github/workflows/test.yml
name: WebDriver Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install
          npm run test:install

      - name: Start application
        run: npm run server &

      - name: Wait for application
        run: npx wait-on http://localhost:3000

      - name: Run tests
        run: npm run test:headless

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-screenshots
          path: www/tests/*.png
```

## Support

For issues or questions:
1. Check this guide and README.md
2. Review existing tests for examples
3. Check WebDriverIO documentation: https://webdriver.io
4. Open an issue in the project repository