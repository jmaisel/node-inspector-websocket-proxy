const {
    SplashPage,
    ToolbarPage,
    EditorPage,
    ConsolePage,
    CircuitPage,
    GutterPage
} = require('../helpers/page-objects');

describe('Integration Tests', () => {
    before(async () => {
        await browser.url('/app/index.html');
        await SplashPage.waitForSplashToDisappear();
        // Load a demo circuit for tests that need file tree content
        await ToolbarPage.loadDemoCircuit();
    });

    describe('Application Initialization', () => {
        it('should load all major UI components', async () => {
            expect(await ToolbarPage.projectMenuBtn.isDisplayed()).to.be.true;
            expect(await EditorPage.fileTreePanel.isDisplayed()).to.be.true;
            expect(await ConsolePage.consolePanel.isDisplayed()).to.be.true;
            expect(await CircuitPage.circuitFrame.isDisplayed()).to.be.true;
        });

        it('should have functional toolbar after load', async () => {
            await ToolbarPage.openProjectMenu();
            expect(await ToolbarPage.projectDropdown.isDisplayed()).to.be.true;
        });
    });

    describe('Mode Switching Workflow', () => {
        it('should switch between Design and Build modes', async () => {
            await ToolbarPage.switchToDesignMode();
            await browser.pause(1000);

            await ToolbarPage.switchToBuildMode();
            await browser.pause(1000);

            await ToolbarPage.switchToDesignMode();
            await browser.pause(1000);
        });
    });

    describe('Console Interaction', () => {
        it('should allow console filtering and clearing', async () => {
            await ConsolePage.searchConsole('test');
            const value = await ConsolePage.consoleSearch.getValue();
            expect(value).to.equal('test');

            await ConsolePage.consoleSearch.clearValue();
        });

        it('should toggle console level filters', async () => {
            await ConsolePage.debugLevelBtn.click();
            await browser.pause(200);

            await ConsolePage.debugLevelBtn.click();
            await browser.pause(200);
        });
    });

    describe('Layout Manipulation', () => {
        it('should maximize and restore panes using gutter controls', async () => {
            await GutterPage.maximizeLeft();
            await browser.pause(500);

            await GutterPage.returnToCenter();
            await browser.pause(500);

            await GutterPage.maximizeRight();
            await browser.pause(500);

            await GutterPage.returnToCenter();
            await browser.pause(500);
        });
    });

    describe('File Tree Interaction', () => {
        it('should search and clear file tree', async () => {
            await EditorPage.searchFiles('main');
            await browser.pause(300);

            await EditorPage.clearFileSearch();
            await browser.pause(300);
        });

        it('should toggle file tree visibility', async () => {
            await EditorPage.toggleFileTree();
            await browser.pause(500);

            await EditorPage.toggleFileTree();
            await browser.pause(500);
        });
    });

    describe('Full Application Workflow', () => {
        it('should perform a complete user workflow', async () => {
            // Open project menu
            await ToolbarPage.openProjectMenu();
            await browser.pause(500);

            // Click elsewhere to close menu
            await ToolbarPage.modeMenuBtn.click();
            await browser.pause(300);

            // Switch to Build mode
            await ToolbarPage.switchToBuildMode();
            await browser.pause(1000);

            // Search for files
            await EditorPage.searchFiles('js');
            await browser.pause(500);

            await EditorPage.clearFileSearch();
            await browser.pause(300);

            // Filter console
            await ConsolePage.searchConsole('error');
            await browser.pause(300);

            await ConsolePage.consoleSearch.clearValue();
            await browser.pause(300);

            // Manipulate layout
            await GutterPage.maximizeLeft();
            await browser.pause(500);

            await GutterPage.returnToCenter();
            await browser.pause(500);

            // Switch back to Design mode
            await ToolbarPage.switchToDesignMode();
            await browser.pause(1000);
        });
    });
});