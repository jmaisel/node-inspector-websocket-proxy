# Contributing to WebDriver Tests

## Adding New Tests

When adding new tests to the suite:

1. **Create a new spec file** in the `specs/` directory following the naming convention: `feature-name.spec.js`

2. **Use page objects** from `helpers/page-objects.js` instead of writing selectors directly in tests

3. **Follow the test structure**:
   ```javascript
   const { PageObject } = require('../helpers/page-objects');

   describe('Feature Name', () => {
       before(async () => {
           await browser.url('/app/index.html');
           await SplashPage.waitForSplashToDisappear();
       });

       describe('Sub-feature', () => {
           it('should do something specific', async () => {
               // Test implementation
           });
       });
   });
   ```

4. **Keep tests isolated** - each test should be independent and not rely on state from previous tests

5. **Use descriptive names** - test names should clearly describe what is being tested

6. **Handle timing** - use `waitForDisplayed()` and similar methods instead of hard-coded pauses when possible

7. **Clean up after tests** - reset state if your test modifies the application

## Adding New Page Objects

When adding new UI elements to test:

1. **Add to existing page object** if it belongs to an existing component
2. **Create new page object class** if it's a new major component
3. **Export the instance** at the bottom of `page-objects.js`
4. **Use getter methods** for element selectors:
   ```javascript
   get elementName() { return $('#element-id'); }
   ```
5. **Add helper methods** for common interactions:
   ```javascript
   async performAction() {
       await this.element.click();
       await this.otherElement.waitForDisplayed();
   }
   ```

## Test Organization

- **Specs by feature** - group tests by UI feature/component
- **Integration tests** - go in `integration.spec.js`
- **Helper utilities** - go in `helpers/` directory
- **Page objects** - centralized in `helpers/page-objects.js`

## Running Specific Tests

Run a single spec:
```bash
npm run test:spec -- specs/toolbar.spec.js
```

Run tests matching a pattern:
```bash
npm run test:spec -- specs/*console*.spec.js
```

## Debugging Tests

Add browser pause to inspect state:
```javascript
await browser.debug(); // Opens REPL
await browser.pause(5000); // Pauses for 5 seconds
```

Take screenshot on failure (automatic in afterTest hook)

Run in non-headless mode to see browser:
```bash
npm test  # Already runs in visible mode by default
```

## Best Practices

1. **Avoid hard-coded waits** - use WebDriverIO's wait functions
2. **Don't test implementation details** - focus on user-visible behavior
3. **Keep tests fast** - avoid unnecessary waits
4. **Make tests readable** - use clear variable names and comments
5. **Handle async properly** - always await async operations
6. **Test error states** - don't just test happy paths
7. **Keep page objects DRY** - reuse helper methods

## CI/CD Integration

These tests are designed to run in CI environments:

```yaml
# Example GitHub Actions
- name: Run WebDriver Tests
  run: |
    cd www/tests
    npm install
    npm run test:headless
```

Set `HEADLESS=true` environment variable for CI environments.