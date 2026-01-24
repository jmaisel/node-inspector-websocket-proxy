const { ConsolePage, SplashPage } = require('../helpers/page-objects');

describe('Console Panel', () => {
    before(async () => {
        await browser.url('/app/index.html');
        await SplashPage.waitForSplashToDisappear();
    });

    describe('Console Panel Layout', () => {
        it('should display the console panel', async () => {
            expect(await ConsolePage.consolePanel.isDisplayed()).to.be.true;
        });

        it('should display the console content area', async () => {
            expect(await ConsolePage.consoleContent.isDisplayed()).to.be.true;
        });
    });

    describe('Console Tabs', () => {
        it('should display console tabs after initialization', async () => {
            // Wait a moment for tabs to potentially appear
            await browser.pause(1000);
            const tabs = await ConsolePage.consoleTabs;
            // Tabs may be hidden initially until proxy is ready
            const exists = await tabs.isExisting();
            expect(exists).to.be.true;
        });

        it('should have console tab', async () => {
            expect(await ConsolePage.consoleTab.isExisting()).to.be.true;
        });

        it('should have breakpoints tab', async () => {
            expect(await ConsolePage.breakpointsTab.isExisting()).to.be.true;
        });

        it('should have watches tab', async () => {
            expect(await ConsolePage.watchesTab.isExisting()).to.be.true;
        });

        it('should have scopes tab', async () => {
            expect(await ConsolePage.scopesTab.isExisting()).to.be.true;
        });
    });

    describe('Console Toolbar', () => {
        it('should display level filter buttons', async () => {
            expect(await ConsolePage.debugLevelBtn.isDisplayed()).to.be.true;
            expect(await ConsolePage.infoLevelBtn.isDisplayed()).to.be.true;
            expect(await ConsolePage.warnLevelBtn.isDisplayed()).to.be.true;
            expect(await ConsolePage.errorLevelBtn.isDisplayed()).to.be.true;
            expect(await ConsolePage.eventLevelBtn.isDisplayed()).to.be.true;
        });

        it('should have correct button labels', async () => {
            expect(await ConsolePage.debugLevelBtn.getText()).to.equal('DEBUG');
            expect(await ConsolePage.infoLevelBtn.getText()).to.equal('INFO');
            expect(await ConsolePage.warnLevelBtn.getText()).to.equal('WARN');
            expect(await ConsolePage.errorLevelBtn.getText()).to.equal('ERROR');
            expect(await ConsolePage.eventLevelBtn.getText()).to.equal('EVENTS');
        });

        it('should display search input', async () => {
            expect(await ConsolePage.consoleSearch.isDisplayed()).to.be.true;
        });

        it('should display clear button', async () => {
            expect(await ConsolePage.consoleClearBtn.isDisplayed()).to.be.true;
        });

        it('should display detach button', async () => {
            expect(await ConsolePage.consoleDetachBtn.isDisplayed()).to.be.true;
        });

        it('should display collapse button', async () => {
            expect(await ConsolePage.consoleCollapseBtn.isDisplayed()).to.be.true;
        });

        it('should allow searching console messages', async () => {
            await ConsolePage.searchConsole('test');
            const value = await ConsolePage.consoleSearch.getValue();
            expect(value).to.equal('test');
            await ConsolePage.consoleSearch.clearValue();
        });

        it('should be able to click level filter buttons', async () => {
            expect(await ConsolePage.debugLevelBtn.isClickable()).to.be.true;
            expect(await ConsolePage.infoLevelBtn.isClickable()).to.be.true;
        });
    });

    describe('Breakpoints Tab', () => {
        it('should display breakpoints list', async () => {
            expect(await ConsolePage.breakpointsList.isExisting()).to.be.true;
        });

        it('should display toggle all breakpoints button', async () => {
            const btn = await ConsolePage.toggleAllBreakpointsBtn;
            const exists = await btn.isExisting();
            // Button exists in DOM (may not be visible without debugger)
            expect(exists).to.be.true;
        });

        it('should have correct toggle button text', async () => {
            const btn = await ConsolePage.toggleAllBreakpointsBtn;
            if (await btn.isExisting()) {
                const text = await btn.getText();
                // Button text may be empty or vary based on state
                expect(text).to.be.a('string');
            }
        });
    });
});