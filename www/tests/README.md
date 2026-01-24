# WebDriver UI Tests

This directory contains WebDriver tests for the Pithagoras/BadgerBox UI.

## Structure

```
www/tests/
├── package.json           # Test dependencies
├── wdio.conf.js          # WebDriver IO configuration
├── README.md             # This file
├── specs/                # Test specifications
│   ├── toolbar.spec.js   # Toolbar functionality tests
│   ├── project.spec.js   # Project management tests
│   ├── editor.spec.js    # Code editor tests
│   ├── console.spec.js   # Console panel tests
│   ├── debug.spec.js     # Debug controls tests
│   └── preferences.spec.js # Preferences tests
└── helpers/              # Test helper utilities
    └── page-objects.js   # Page object models
```

## Setup

1. Install dependencies:
   ```bash
   cd www/tests
   npm install
   ```

2. Make sure the application server is running on `http://localhost:8080`:
   ```bash
   cd server
   npm install
   npm start
   ```

## Running Tests

Run all tests:
```bash
npm test
```

Run tests in headless mode:
```bash
npm run test:headless
```

Run a specific test file:
```bash
npm run test:spec -- specs/toolbar.spec.js
```

Run tests in watch mode (re-run on file changes):
```bash
npm run test:watch
```

## Writing Tests

Tests use WebDriver IO with Mocha framework and Chai assertions.

Example test structure:
```javascript
describe('Component Name', () => {
    before(async () => {
        await browser.url('/');
    });

    it('should do something', async () => {
        const element = await $('#element-id');
        await element.click();
        expect(await element.getText()).to.equal('Expected Text');
    });
});
```

## Integration with Plugin Architecture

These tests are designed to move with the www/ folder when transitioning to a plugin architecture. The test suite:
- Lives alongside the UI code it tests
- Uses isolated dependencies (separate package.json)
- Can be run independently
- Will move seamlessly when www/ becomes a plugin